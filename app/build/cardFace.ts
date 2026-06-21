/**
 * cardFace — paints the printed face of the employee badge. Two canvases:
 *  - FACE: the visible print (transparent outside a rounded-rect mask so it sits
 *    flush on the rounded card), with a pill SLOT near the top (the lanyard threads
 *    through it), the STM wordmark, the generative ring (seeded by the nickname),
 *    and name + employee id (Inter).
 *  - EMISSIVE: the ring ALONE on black — fed to the material's emissiveMap so the
 *    ring core stays vivid even when the key light would otherwise wash it out.
 * Card is golden-ratio portrait. Inter is reused from next/font via a computed
 * family probe. All client-side.
 */

import * as THREE from "three";
import { exportThumbnailSVG, exportSVG } from "@stm-ring";

export const GOLDEN = 1.618;
export const FACE_W = 900; // hi-res print
export const FACE_H = Math.round(FACE_W * GOLDEN); // golden-ratio portrait
const CORNER = Math.round(FACE_W * 0.0425); // == card body radius 0.085 / CARD_W 2.0

const INK = "#0a0a0b";
const ID_INK = "#b9bac1";

let interFamily: string | null = null;
function resolveInter(): string {
  if (interFamily) return interFamily;
  const probe = document.createElement("span");
  probe.style.fontFamily = "var(--font-sans)";
  document.body.appendChild(probe);
  interFamily = getComputedStyle(probe).fontFamily || "Inter, system-ui, sans-serif";
  probe.remove();
  return interFamily;
}

// No crossOrigin: same-origin wordmark + data-URL ring never taint the canvas, and
// "anonymous" makes WebKit reject the same-origin SVG ("Load failed").
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

let logoPromise: Promise<HTMLImageElement> | null = null;
const ringCache = new Map<string, Promise<HTMLImageElement>>();
// Empty nickname → the STM ring at REST (dark, no charge). A name → the colour
// twisted hash for that name. Lower N/K keeps per-keystroke generation cheap.
function ringImage(name: string): Promise<HTMLImageElement> {
  const key = name || "__rest__";
  let p = ringCache.get(key);
  if (!p) {
    const svg = name ? exportThumbnailSVG(name, 768, false, 240, 72) : exportSVG({ size: 768 });
    p = loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    ringCache.set(key, p);
  }
  return p;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export type FaceData = { name: string; id: string };
export type Layer = { canvas: HTMLCanvasElement; tex: THREE.Texture };

// ring geometry on the face (shared by both layers)
const RING_W_FRAC = 0.82;

/** Paint `data` into the FACE and EMISSIVE canvases and flag both textures. */
export async function paintCardFace(face: Layer, emis: Layer, data: FaceData) {
  const fctx = face.canvas.getContext("2d");
  const ectx = emis.canvas.getContext("2d");
  if (!fctx || !ectx) return;
  const W = face.canvas.width;
  const H = face.canvas.height;

  const name = (data?.name ?? "").trim();
  const id = data?.id ?? "";

  if (!logoPromise) logoPromise = loadImage("/STM%20logo%20long%20text.svg");
  try {
    await (document.fonts?.ready ?? Promise.resolve());
  } catch {
    /* fonts API missing — fall through with fallback family */
  }
  const fam = resolveInter();
  const [logo, ring] = await Promise.all([logoPromise, ringImage(name)]);

  // ring graphic — ABSOLUTELY centred on the card
  const rs = W * RING_W_FRAC;
  const rh = rs * (171 / 176);
  const rx = (W - rs) / 2;
  const ry = H * 0.47 - rh / 2; // centred a touch above the middle

  // ── FACE (real rounded card + real slot are GEOMETRY; here just print) ─────
  fctx.clearRect(0, 0, W, H);
  fctx.save();
  roundRectPath(fctx, 0, 0, W, H, CORNER);
  fctx.clip();
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, W, H);

  // wordmark — top (clear of the slot hole above it)
  const lw = W * 0.44;
  const lh = lw * (logo.height / logo.width || 0.157);
  fctx.drawImage(logo, (W - lw) / 2, H * 0.12, lw, lh);

  // generative ring — centre
  fctx.drawImage(ring, rx, ry, rs, rh);

  // name — UNDER the ring
  fctx.textAlign = "center";
  fctx.textBaseline = "alphabetic";
  fctx.fillStyle = INK;
  fctx.font = `700 ${Math.round(W * 0.112)}px ${fam}`;
  fctx.fillText(name || "Your name", W / 2, H * 0.8);

  // employee id — bottom
  fctx.fillStyle = ID_INK;
  fctx.font = `700 ${Math.round(W * 0.044)}px ${fam}`;
  fctx.letterSpacing = "5px";
  fctx.fillText(id, W / 2, H * 0.885);
  fctx.letterSpacing = "0px";
  fctx.restore();

  // ── EMISSIVE (ring alone on black — keeps the ring vivid under light) ──────
  ectx.clearRect(0, 0, W, H);
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, W, H);
  ectx.drawImage(ring, rx, ry, rs, rh);

  face.tex.needsUpdate = true;
  emis.tex.needsUpdate = true;
}
