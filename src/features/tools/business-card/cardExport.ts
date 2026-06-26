/**
 * cardExport — print-ready output, both faces, exactly 90×54mm with 3mm bleed and
 * corner crop marks (built straight from the cardFaces vector source of truth).
 *
 *   • SVG — the true VECTOR deliverable: native, dependency-free, preserves the
 *     blend modes; opens in Illustrator/Inkscape/any modern viewer. Both faces
 *     stacked as two artboards in one document.
 *   • PDF — a hand-to-the-printer file: each face rasterised at 300 dpi at the exact
 *     physical size (the browser bakes the blend modes perfectly), two pages. jsPDF
 *     is imported lazily so it never weighs on the page load.
 */
import { buildFace, type FaceAssets } from "./cardFaces";
import { CARD_MM, BLEED_MM, type CardModel } from "./cardModel";

const MARK_MM = 4; // crop-mark quiet zone (matches cardFaces' marks margin)
const FULL_W = CARD_MM.w + 2 * (BLEED_MM + MARK_MM); // 104
const FULL_H = CARD_MM.h + 2 * (BLEED_MM + MARK_MM); // 68

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "card";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Both faces as one print-ready VECTOR SVG (stacked artboards, bleed + crop marks). */
export function downloadSVG(model: CardModel, assets: FaceAssets) {
  const place = (svg: string, ty: number) => {
    const body = svg.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
    return `<g transform="translate(0 ${ty})">${body}</g>`;
  };
  const front = buildFace("front", model, assets, { bleed: BLEED_MM, marks: true });
  const back = buildFace("back", model, assets, { bleed: BLEED_MM, marks: true });
  const gap = 8;
  const minXY = -(BLEED_MM + MARK_MM);
  const totalH = FULL_H * 2 + gap;
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FULL_W}mm" height="${totalH}mm" ` +
    `viewBox="${minXY} ${minXY} ${FULL_W} ${totalH}">` +
    place(front, 0) +
    place(back, FULL_H + gap) +
    `</svg>`;
  triggerDownload(new Blob([doc], { type: "image/svg+xml" }), `${slug(model.name)}-business-card.svg`);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function rasterFace(side: "front" | "back", model: CardModel, assets: FaceAssets, pxPerMm: number): Promise<string> {
  const svg = buildFace(side, model, assets, { bleed: BLEED_MM, marks: true, px: pxPerMm });
  const w = Math.round(FULL_W * pxPerMm);
  const h = Math.round(FULL_H * pxPerMm);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // paper behind the marks' quiet zone
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Both faces as a 2-page, 300 dpi, exact-size print PDF (bleed + crop marks). */
export async function downloadPDF(model: CardModel, assets: FaceAssets) {
  const pxPerMm = 300 / 25.4;
  const [front, back] = await Promise.all([
    rasterFace("front", model, assets, pxPerMm),
    rasterFace("back", model, assets, pxPerMm),
  ]);
  const { jsPDF } = await import("jspdf");
  // FULL_W > FULL_H, so the page is landscape — state it explicitly, else jsPDF defaults
  // to portrait and swaps the custom format (the card came out rotated / cropped).
  const pdf = new jsPDF({ unit: "mm", format: [FULL_W, FULL_H], orientation: "landscape" });
  pdf.addImage(front, "PNG", 0, 0, FULL_W, FULL_H);
  pdf.addPage([FULL_W, FULL_H], "landscape");
  pdf.addImage(back, "PNG", 0, 0, FULL_W, FULL_H);
  pdf.save(`${slug(model.name)}-business-card.pdf`);
}
