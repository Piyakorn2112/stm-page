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

// name field, printed as a real input control. Empty OR focused → a rounded box with a
// border (signals "type here" / active input); once it holds a name and loses focus it
// collapses to plain ink text with no chrome. The badge print is a white card in BOTH
// site themes, so these greys + the brand accent are scheme-independent by design.
const PLACEHOLDER = "Enter a name";
const PLACEHOLDER_INK = "#9596a0"; // --faint
const FIELD_BORDER_IDLE = "#d3d4da"; // faint grey — empty default state
const FIELD_ACTIVE = "#5057ff"; // brand indigo — focused border + caret (matches site focus)

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

export type FaceData = { name: string; id?: string; focused?: boolean; caretOn?: boolean };
export type Layer = { canvas: HTMLCanvasElement; tex: THREE.Texture };

// the name field's vertical band on the face (above the id, below the ring) — the only
// region paintNameField repaints, so realtime typing never touches the heavy ring.
const NAME_BAND_Y = 0.73;
const NAME_BAND_H = 0.12;

/** Draw the name field (border / placeholder / ink text / caret) for the given state. */
function drawNameField(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  fam: string,
  name: string,
  focused: boolean,
  caretOn: boolean,
) {
  const cx = W / 2;
  const baseY = H * 0.8;
  const fontPx = Math.round(W * 0.112);
  const has = name.length > 0;
  const showBorder = focused || !has;
  // text in the field: the name, else the placeholder (shown only when idle + empty)
  const label = has ? name : focused ? "" : PLACEHOLDER;
  // the placeholder reads as a hint ⇒ smaller + lighter (500 vs the name's 700);
  // the actual name keeps the full size + weight
  const isPlaceholder = !has && !focused;
  const labelWeight = isPlaceholder ? 500 : 700;
  let labelPx = isPlaceholder ? Math.round(fontPx * 0.6) : fontPx;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${labelWeight} ${labelPx}px ${fam}`;
  let tw = label ? ctx.measureText(label).width : 0;
  // safety: a name keeps its full size unless it would overrun the card — then it auto-fits
  // (glyph widths vary too much for a char limit alone to guarantee it). Normal names: untouched.
  const SAFE = W * 0.79;
  if (has && tw > SAFE) {
    labelPx = Math.max(Math.round(fontPx * 0.66), Math.floor((labelPx * SAFE) / tw));
    ctx.font = `${labelWeight} ${labelPx}px ${fam}`;
    tw = ctx.measureText(label).width;
  }

  if (showBorder) {
    const boxW = Math.max(W * 0.52, tw + W * 0.09);
    const boxH = fontPx * 1.36;
    roundRectPath(ctx, cx - boxW / 2, baseY - fontPx * 0.97, boxW, boxH, boxH * 0.3);
    ctx.lineWidth = Math.max(2.5, W * 0.0046);
    ctx.strokeStyle = focused ? FIELD_ACTIVE : FIELD_BORDER_IDLE;
    ctx.stroke();
  }
  if (label) {
    ctx.fillStyle = has ? INK : PLACEHOLDER_INK;
    // nudge just the placeholder TEXT up 5px within the box (the name stays on the baseline)
    ctx.fillText(label, cx, isPlaceholder ? baseY - 5 : baseY);
  }
  // blinking caret while focused — after the name, or centred when the field is empty
  if (focused && caretOn) {
    const caretX = has ? cx + tw / 2 + fontPx * 0.07 : cx;
    const cw = Math.max(2.5, W * 0.006);
    ctx.fillStyle = FIELD_ACTIVE;
    ctx.fillRect(caretX - cw / 2, baseY - fontPx * 0.74, cw, fontPx * 0.82);
  }
}

/**
 * Repaint ONLY the name band (clear → redraw the field) — cheap enough to run on every
 * keystroke / caret blink so typing tracks in real time. The heavy ring repaint
 * (paintCardFace) stays debounced; the two never overlap on the canvas.
 */
export async function paintNameField(face: Layer, data: FaceData) {
  const ctx = face.canvas.getContext("2d");
  if (!ctx) return;
  const W = face.canvas.width;
  const H = face.canvas.height;
  try {
    await (document.fonts?.ready ?? Promise.resolve());
  } catch {
    /* fonts API missing — fall through with fallback family */
  }
  const fam = resolveInter();
  const name = (data.name ?? "").trim();
  ctx.save();
  roundRectPath(ctx, 0, 0, W, H, CORNER); // stay inside the rounded print
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, H * NAME_BAND_Y, W, H * NAME_BAND_H);
  drawNameField(ctx, W, H, fam, name, !!data.focused, !!data.caretOn);
  ctx.restore();
  face.tex.needsUpdate = true;
}

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

  // name — UNDER the ring (real input control: bordered when empty/focused, plain ink else)
  drawNameField(fctx, W, H, fam, name, !!data?.focused, !!data?.caretOn);

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
