/**
 * cardExport — professional, print-shop-ready output, driven by an ExportSpec the
 * export dialog assembles. Everything is built from the SAME cardFaces vector source of
 * truth, so screen and print never drift.
 *
 *   FORMAT   svg · pdf · png · jpg
 *   SIDES    both · front · back
 *   LAYOUT   trim   — the bare card at 90×54mm (web / preview)
 *            bleed  — one card with 3mm bleed + corner crop marks (hand to a printer)
 *            sheet  — a STEP-AND-REPEAT gang-up imposed on an A4 / US-Letter press sheet
 *                     with cut marks, the way a copy/print shop wants it
 *
 * Vector (svg) stays vector; raster (png/jpg) + pdf rasterise each artboard at the chosen
 * dpi (300 default — the print standard). jsPDF is imported lazily so it never weighs on load.
 */
import { buildFace, type FaceAssets } from "./cardFaces";
import { CARD_MM, BLEED_MM, accentIndexForSeed, type CardModel } from "./cardModel";
import { PALETTE } from "@stm-ring";

/* ── the spec the dialog produces ───────────────────────────────────────────────── */
export type ExportFormat = "svg" | "pdf" | "png" | "jpg";
export type ExportSides = "both" | "front" | "back";
export type ExportLayout = "trim" | "bleed" | "sheet";
export type SheetSize = "a4" | "letter";
export type ExportSpec = {
  format: ExportFormat;
  sides: ExportSides;
  layout: ExportLayout;
  sheet: SheetSize;
  dpi: number;
};

export const DEFAULT_SPEC: ExportSpec = {
  format: "pdf",
  sides: "both",
  layout: "bleed",
  sheet: "a4",
  dpi: 300,
};

type Side = "front" | "back";

const MARK_MM = 4; // crop-mark quiet zone (matches cardFaces' marks margin)
const JPG_QUALITY = 0.92;

/** Press-sheet stock sizes (mm). */
export const SHEETS: Record<SheetSize, { w: number; h: number; label: string }> = {
  a4: { w: 210, h: 297, label: "A4" },
  letter: { w: 215.9, h: 279.4, label: "US Letter" },
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "card";

const f = (n: number) => Number(n.toFixed(3));
const facesOf = (sides: ExportSides): Side[] => (sides === "both" ? ["front", "back"] : [sides]);
const faceFill = (model: CardModel, side: Side) =>
  side === "front" ? "#ffffff" : PALETTE[accentIndexForSeed(model.seed)];

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

/* re-id an SVG fragment so N stamped copies on a sheet never share gradient/clip/mask ids
   (the same technique cardFaces uses internally for its two same-seed rings) */
function reId(svg: string, prefix: string): string {
  return svg
    .replace(/id="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^")]+)\)/g, `url(#${prefix}$1)`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, `$1="#${prefix}$2"`);
}

/* ── imposition: step-and-repeat grid for one press sheet ───────────────────────────
   Each card keeps its FULL 3mm bleed; neighbours are spaced by a 2×bleed gutter so a
   single guillotine cut down the gutter centre trims both cleanly. We try the card in
   both orientations and keep whichever fits MORE cards (A4 ⇒ 9 cards, rotated; Letter ⇒ 8). */
type Impose = {
  rot: boolean; // card rotated 90° on the sheet
  cols: number;
  rows: number;
  onW: number; // on-sheet trim width of a card
  onH: number; // on-sheet trim height of a card
  cellW: number;
  cellH: number;
  blockLeft: number; // clear margin to the left of the bleed block
  blockTop: number;
  count: number;
};

function imposeGrid(sheetW: number, sheetH: number, bleed: number): Impose {
  const gut = 2 * bleed;
  const layoutFor = (onW: number, onH: number, rot: boolean): Impose => {
    const cellW = onW + gut;
    const cellH = onH + gut;
    const cols = Math.max(0, Math.floor(sheetW / cellW));
    const rows = Math.max(0, Math.floor(sheetH / cellH));
    return {
      rot,
      cols,
      rows,
      onW,
      onH,
      cellW,
      cellH,
      blockLeft: (sheetW - cols * cellW) / 2,
      blockTop: (sheetH - rows * cellH) / 2,
      count: cols * rows,
    };
  };
  const straight = layoutFor(CARD_MM.w, CARD_MM.h, false);
  const rotated = layoutFor(CARD_MM.h, CARD_MM.w, true);
  return rotated.count > straight.count ? rotated : straight;
}

/** How many cards a sheet size holds (for the dialog's live count). */
export const sheetCount = (sheet: SheetSize): number => {
  const s = SHEETS[sheet];
  return imposeGrid(s.w, s.h, BLEED_MM).count;
};

/* a face turned into a reusable <symbol> (ids prefixed once) so it can be stamped many times */
function faceSymbol(side: Side, model: CardModel, assets: FaceAssets, bleed: number, id: string): string {
  const raw = buildFace(side, model, assets, { bleed, marks: false });
  const vb = raw.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${CARD_MM.w} ${CARD_MM.h}`;
  const inner = raw.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  return `<symbol id="${id}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${reId(inner, `${id}-`)}</symbol>`;
}

/* ── one press sheet (A4 / Letter) of imposed cards, as SVG (mm, or px when rastering) ── */
function buildSheet(
  side: Side,
  model: CardModel,
  assets: FaceAssets,
  sheet: SheetSize,
  px?: number,
): { svg: string; wmm: number; hmm: number } {
  const { w: SW, h: SH } = SHEETS[sheet];
  const b = BLEED_MM;
  const g = imposeGrid(SW, SH, b);
  const symId = "bc-card";
  const sym = faceSymbol(side, model, assets, b, symId);

  // one stamped card, centred at the cell trim-centre, rotated if the grid is rotated.
  // the symbol stays in its NATIVE landscape footprint (90×54 + bleed); on-sheet rotation
  // comes only from the group's rotate(90), so the <use> box must NOT be pre-swapped.
  const boxW = CARD_MM.w + 2 * b;
  const boxH = CARD_MM.h + 2 * b;
  const rot = g.rot ? " rotate(90)" : "";
  const stamps: string[] = [];
  const marks: string[] = [];
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const ccx = g.blockLeft + b + g.onW / 2 + c * g.cellW;
      const ccy = g.blockTop + b + g.onH / 2 + r * g.cellH;
      stamps.push(
        `<g transform="translate(${f(ccx)} ${f(ccy)})${rot}"><use href="#${symId}" x="${f(
          -boxW / 2,
        )}" y="${f(-boxH / 2)}" width="${f(boxW)}" height="${f(boxH)}"/></g>`,
      );
      xs.add(f(ccx - g.onW / 2));
      xs.add(f(ccx + g.onW / 2));
      ys.add(f(ccy - g.onH / 2));
      ys.add(f(ccy + g.onH / 2));
    }
  }

  // cut marks: a short tick in the clear paper margin for every trim line (vertical ticks
  // top & bottom, horizontal ticks left & right) — the guillotine guide a shop expects
  const mk = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#111" stroke-width="0.12"/>`;
  const gap = 0.6;
  const vLen = Math.min(3, g.blockTop - gap - 0.4);
  const hLen = Math.min(3, g.blockLeft - gap - 0.4);
  if (vLen >= 1) {
    for (const x of xs) {
      marks.push(mk(x, g.blockTop - gap, x, g.blockTop - gap - vLen));
      marks.push(mk(x, SH - g.blockTop + gap, x, SH - g.blockTop + gap + vLen));
    }
  }
  if (hLen >= 1) {
    for (const y of ys) {
      marks.push(mk(g.blockLeft - gap, y, g.blockLeft - gap - hLen, y));
      marks.push(mk(SW - g.blockLeft + gap, y, SW - g.blockLeft + gap + hLen, y));
    }
  }

  const wAttr = px ? `${f(SW * px)}` : `${SW}mm`;
  const hAttr = px ? `${f(SH * px)}` : `${SH}mm`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wAttr}" height="${hAttr}" viewBox="0 0 ${SW} ${SH}">` +
    `<defs>${sym}</defs>` +
    `<rect x="0" y="0" width="${SW}" height="${SH}" fill="#ffffff"/>` +
    stamps.join("") +
    `<g>${marks.join("")}</g>` +
    `</svg>`;
  return { svg, wmm: SW, hmm: SH };
}

/* ── one artboard (a single face) per the chosen layout, as SVG (mm, or px for raster) ── */
function buildArtboard(
  side: Side,
  spec: ExportSpec,
  model: CardModel,
  assets: FaceAssets,
  px?: number,
): { svg: string; wmm: number; hmm: number } {
  if (spec.layout === "sheet") return buildSheet(side, model, assets, spec.sheet, px);
  if (spec.layout === "bleed") {
    const wmm = CARD_MM.w + 2 * (BLEED_MM + MARK_MM);
    const hmm = CARD_MM.h + 2 * (BLEED_MM + MARK_MM);
    return { svg: buildFace(side, model, assets, { bleed: BLEED_MM, marks: true, px }), wmm, hmm };
  }
  return { svg: buildFace(side, model, assets, { px }), wmm: CARD_MM.w, hmm: CARD_MM.h };
}

/* ── rasterise an artboard SVG (already px-sized) to a PNG/JPG data URL ──────────────── */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function rasterize(svg: string, wmm: number, hmm: number, dpi: number, jpg: boolean): Promise<string> {
  const px = dpi / 25.4;
  const w = Math.round(wmm * px);
  const h = Math.round(hmm * px);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // flatten onto paper (jpg has no alpha; png keeps a clean white)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(jpg ? "image/jpeg" : "image/png", jpg ? JPG_QUALITY : undefined);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* file-name pieces */
const layoutTag = (layout: ExportLayout) => (layout === "sheet" ? "print-sheet" : "business-card");
const faceName = (base: string, side: Side, spec: ExportSpec) =>
  `${base}-${side}${spec.layout === "sheet" ? "-sheet" : ""}`;

/* ── the one public entry the dialog calls ──────────────────────────────────────────── */
export async function exportCard(spec: ExportSpec, model: CardModel, assets: FaceAssets): Promise<void> {
  const base = slug(model.name);
  const sides = facesOf(spec.sides);

  // VECTOR — keep it vector. Both faces stack as two artboards in one document.
  if (spec.format === "svg") {
    const boards = sides.map((s) => buildArtboard(s, spec, model, assets));
    if (boards.length === 1) {
      triggerDownload(
        new Blob([boards[0].svg], { type: "image/svg+xml" }),
        `${faceName(base, sides[0], spec)}.svg`,
      );
      return;
    }
    const gapMm = 8;
    const place = (svg: string, ty: number, w: number, h: number) => {
      const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${w} ${h}`;
      const inner = svg.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
      const [mx, my] = vb.split(/\s+/).map(Number);
      return `<g transform="translate(${f(-mx)} ${f(ty - my)})">${inner}</g>`;
    };
    const w = boards[0].wmm;
    const totalH = boards[0].hmm + gapMm + boards[1].hmm;
    const doc =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}mm" height="${f(totalH)}mm" viewBox="0 0 ${f(
        w,
      )} ${f(totalH)}">` +
      place(boards[0].svg, 0, boards[0].wmm, boards[0].hmm) +
      place(boards[1].svg, boards[0].hmm + gapMm, boards[1].wmm, boards[1].hmm) +
      `</svg>`;
    triggerDownload(new Blob([doc], { type: "image/svg+xml" }), `${base}-${layoutTag(spec.layout)}.svg`);
    return;
  }

  // RASTER (png/jpg) — one file per face, at the chosen dpi.
  if (spec.format === "png" || spec.format === "jpg") {
    const jpg = spec.format === "jpg";
    for (let i = 0; i < sides.length; i++) {
      const side = sides[i];
      const board = buildArtboard(side, spec, model, assets, spec.dpi / 25.4);
      const data = await rasterize(board.svg, board.wmm, board.hmm, spec.dpi, jpg);
      const blob = await (await fetch(data)).blob();
      triggerDownload(blob, `${faceName(base, side, spec)}.${spec.format}`);
      if (i < sides.length - 1) await new Promise((r) => setTimeout(r, 350)); // let the browser queue both
    }
    return;
  }

  // PDF — a hand-to-the-printer file: each face rasterised at the chosen dpi at its exact
  // physical size, one page per face. jsPDF lazily imported.
  const pages = await Promise.all(
    sides.map(async (side) => {
      const board = buildArtboard(side, spec, model, assets, spec.dpi / 25.4);
      const data = await rasterize(board.svg, board.wmm, board.hmm, spec.dpi, false);
      return { data, w: board.wmm, h: board.hmm, fill: faceFill(model, side) };
    }),
  );
  const { jsPDF } = await import("jspdf");
  const first = pages[0];
  // state orientation explicitly (jsPDF otherwise forces portrait and rotates a landscape format)
  const orient = (w: number, h: number) => (w >= h ? "landscape" : "portrait");
  const pdf = new jsPDF({ unit: "mm", format: [first.w, first.h], orientation: orient(first.w, first.h) });
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage([p.w, p.h], orient(p.w, p.h));
    pdf.addImage(p.data, "PNG", 0, 0, p.w, p.h);
  });
  pdf.save(`${base}-${layoutTag(spec.layout)}.pdf`);
}
