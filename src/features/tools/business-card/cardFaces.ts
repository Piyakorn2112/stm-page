/**
 * cardFaces — the SINGLE SOURCE OF TRUTH for both card faces, as SVG. The same
 * vector is rasterised to a texture for the 3D card AND wrapped (bleed + crop marks)
 * for the print-ready export, so screen and print never drift.
 *
 * Layout follows the reference + annotated spec:
 *   FRONT  white stock · an oversized full-colour ring (the selected seed) bleeding
 *          off all edges · the "srang tech mai" wordmark, large + legible, on top.
 *   BACK   accent stock · the SAME seed as a grey ring in "screen" blend @ 50% · a
 *          same-accent veil @ 40% over the body (mutes the ring under the text) · the
 *          wordmark (top-left) + site (top-right) + name / title / email / tel · a
 *          clipped, seeded bloom-code decoration + the tri-colour mark, bottom-right.
 *
 * Coordinates are millimetres (viewBox `0 0 90 54`), so the export is dimensionally
 * exact. Note on blend modes: "screen" is honoured natively (CSS/SVG/PDF all support
 * it); "divide" (the front's Figma technique) has no SVG/PDF equivalent, so the front
 * is composed to MATCH the intended look in standard layers rather than a blend that
 * print can't reproduce.
 */
import { exportThumbnailSVG, exportSVG, SETTLE_POSE, encodeBloomSVG, MAX_PAYLOAD, PALETTE } from "@stm-ring";
import { CARD_MM, accentIndexForSeed, type CardModel } from "./cardModel";

// a seed → a 24-bit Bloom Code payload (deterministic per card; "no meaning" decoration
// per the brief, but a REAL, scannable bloom code straight from the ring engine)
const bloomPayload = (seed: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % (MAX_PAYLOAD + 1);
};

// place a square engine SVG (ring / bloom) as a sized, clipped nested viewport
function placeSquare(svg: string, cx: number, cy: number, size: number): string {
  const vb = svg.match(/viewBox="([^"]+)"/i)?.[1] ?? "0 0 1000 1000";
  const inner = svg.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  return `<svg x="${f(cx - size / 2)}" y="${f(cy - size / 2)}" width="${f(size)}" height="${f(
    size,
  )}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

export type WordmarkAsset = { viewBox: string; inner: string };
export type FaceAssets = { wordmark: WordmarkAsset | null; fontCss?: string | null };

const W = CARD_MM.w; // 90
const H = CARD_MM.h; // 54
const RING_AR = 176 / 171; // engine viewBox aspect
const FONT = `'InterCard','Inter','Helvetica Neue',Arial,sans-serif`;
const RING_SEG = 400; // card-ring detail (well above the 240 thumbnail default)
const RING_PIECES = 100; // charge-strand count — the "colour circles"

const f = (n: number) => Number(n.toFixed(3));
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// high-res ring SVGs are heavy; cache by seed so editing text doesn't regenerate them
const ringCache = new Map<string, string>();
function cachedRing(key: string, gen: () => string): string {
  let v = ringCache.get(key);
  if (v === undefined) {
    v = gen();
    ringCache.set(key, v);
    if (ringCache.size > 48) {
      const first = ringCache.keys().next().value;
      if (first !== undefined) ringCache.delete(first);
    }
  }
  return v;
}

/* namespace every id (and its url(#…)/href references) in an SVG fragment, so two
   exports of the SAME seed (e.g. the front's colour ring + its white mask ring) don't
   share gradient ids — without this the second one's gradients clobber the first's. */
function prefixIds(svg: string, prefix: string): string {
  return svg
    .replace(/id="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^")]+)\)/g, `url(#${prefix}$1)`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, `$1="#${prefix}$2"`);
}

/* strip the outer <svg> wrapper off an engine ring export and re-place it as a sized,
   nested viewport (keeps the engine's native 176×171 coords) */
function placeRing(svg: string, x: number, y: number, w: number, h: number, style = ""): string {
  const inner = svg.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  const st = style ? ` style="${style}"` : "";
  return `<svg x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" viewBox="0 0 176 171" preserveAspectRatio="xMidYMid meet"${st}>${inner}</svg>`;
}

const wordmarkW = (a: WordmarkAsset, h: number): number => {
  const [, , vbW, vbH] = a.viewBox.split(/\s+/).map(Number);
  return h * (vbW / vbH);
};

function placeWordmark(a: WordmarkAsset | null, x: number, y: number, h: number, fill: string): string {
  if (!a) {
    // graceful fallback: set the lockup as text until the asset has loaded
    return `<text x="${f(x)}" y="${f(y + h * 0.82)}" font-family="${FONT}" font-size="${f(
      h,
    )}" font-weight="700" letter-spacing="-0.02em" fill="${fill}">srang tech mai</text>`;
  }
  const w = wordmarkW(a, h);
  return `<svg x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" viewBox="${a.viewBox}"><g fill="${fill}">${a.inner}</g></svg>`;
}

/* ── FRONT ─────────────────────────────────────────────────────────────────────── */
function composeFront(model: CardModel, assets: FaceAssets): string {
  // full-colour ring + a WHITE silhouette of the SAME ring (the knockout mask), both
  // high-res + cached per seed so text edits are free
  const ring = cachedRing(`c:${model.seed}`, () =>
    exportThumbnailSVG(model.seed, 100, false, RING_SEG, RING_PIECES),
  );
  const ringMask = cachedRing(`m:${model.seed}`, () =>
    prefixIds(
      exportSVG({
        id: model.seed,
        t: SETTLE_POSE.t,
        twistT: SETTLE_POSE.twistT,
        morph: SETTLE_POSE.morph,
        white: true,
        size: 100,
        segments: RING_SEG,
        pieces: RING_PIECES,
      }),
      "m-",
    ),
  );
  // oversized ring, centred, bleeding off the edges
  const rW = 98;
  const rH = rW / RING_AR;
  const rx = W / 2 - rW / 2;
  const ry = H / 2 - rH / 2;
  const ringEl = placeRing(ring, rx, ry, rW, rH);
  const maskRing = placeRing(ringMask, rx, ry, rW, rH);
  // wordmark — LARGE (≈fills the card width like the ref), nudged down a touch for
  // optical centring. Black ink on the stock; a white copy MASKED to the ring footprint
  // knocks the letters to white only where they overlap the ring (no colour shift).
  const wmH = 12.4;
  const wmW = assets.wordmark ? wordmarkW(assets.wordmark, wmH) : 78;
  const wx = (W - wmW) / 2;
  const wy = (H - wmH) / 2 + 1.4;
  const wmBlack = placeWordmark(assets.wordmark, wx, wy, wmH, "#0a0a0b");
  const wmWhite = placeWordmark(assets.wordmark, wx, wy, wmH, "#ffffff");
  // tagline — bottom centre, regular weight, SAME knockout logic as the logo
  const tagline = "We build software, products, and ventures.";
  const tag = (fill: string) =>
    `<text x="${f(W / 2)}" y="48.4" font-family="${FONT}" font-size="2.5" font-weight="400" fill="${fill}" text-anchor="middle" letter-spacing="0.005em">${esc(
      tagline,
    )}</text>`;
  return (
    `<defs><mask id="cf-fmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000"/>${maskRing}</mask></defs>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>` +
    ringEl +
    wmBlack +
    tag("#0a0a0b") +
    `<g mask="url(#cf-fmask)">${wmWhite}${tag("#ffffff")}</g>`
  );
}

/* ── BACK ──────────────────────────────────────────────────────────────────────── */
function composeBack(model: CardModel, assets: FaceAssets): string {
  const ai = accentIndexForSeed(model.seed);
  const accent = PALETTE[ai];
  const grey = cachedRing(`g:${model.seed}`, () =>
    exportThumbnailSVG(model.seed, 100, true, RING_SEG, RING_PIECES),
  );

  // grey ring (screen 50%) — EXACT same size + position as the front ring, so the two
  // faces register (same seed, same pose, same box)
  const rW = 98;
  const rH = rW / RING_AR;
  const rx = W / 2 - rW / 2;
  const ry = H / 2 - rH / 2;
  const greyRing = placeRing(grey, rx, ry, rW, rH, "mix-blend-mode:screen;opacity:0.5");

  // accent veil @ 40% — below the top strip, above the ring, below the text
  const veil = `<rect x="0" y="11.5" width="${W}" height="${H - 11.5}" fill="${accent}" opacity="0.4"/>`;

  // the real Bloom Code — mono white ink, no colour, no corner flower (just the orbit
  // field), clipped into the bottom-right corner like a maker's mark
  const bloom = placeSquare(
    encodeBloomSVG(bloomPayload(model.seed), { ink: "#ffffff", spark: "#ffffff", flower: false }),
    83,
    41,
    46,
  );

  // text — wordmark TL, site TR, then name / title / contact, all white
  const t = (
    x: number,
    y: number,
    size: number,
    weight: number,
    str: string,
    opacity = 1,
    anchor = "start",
  ) =>
    `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${f(size)}" font-weight="${weight}" fill="#ffffff" fill-opacity="${opacity}" text-anchor="${anchor}" letter-spacing="-0.01em">${esc(
      str,
    )}</text>`;
  // empty field → a generic placeholder, rendered dimmer so it reads as a prompt
  const field = (
    x: number,
    y: number,
    size: number,
    weight: number,
    value: string,
    ph: string,
    base = 1,
    anchor = "start",
  ) => {
    const empty = !value.trim();
    return t(x, y, size, weight, empty ? ph : value, empty ? base * 0.5 : base, anchor);
  };

  const wm = placeWordmark(assets.wordmark, 6, 5, 3.4, "#ffffff");
  const text =
    field(84, 7.7, 2.3, 500, model.url, "yoursite.com", 0.92, "end") +
    field(6, 26, 4.1, 650, model.name, "Full Name") +
    field(6, 30.6, 2.5, 500, model.title, "Your role", 0.85) +
    t(6, 40.2, 2.3, 700, "Email") +
    field(15.4, 40.2, 2.3, 400, model.email, "you@email.com", 0.95) +
    t(6, 44.4, 2.3, 700, "Tel.") +
    field(15.4, 44.4, 2.3, 400, model.tel, "000 000 0000", 0.95);

  return (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${accent}"/>` +
    greyRing +
    veil +
    bloom +
    wm +
    text
  );
}

/* ── public: a complete face SVG, optionally with print bleed + crop marks ──────── */
export function buildFace(
  side: "front" | "back",
  model: CardModel,
  assets: FaceAssets,
  opts: { bleed?: number; marks?: boolean; px?: number } = {},
): string {
  const bleed = opts.bleed ?? 0;
  const body = side === "front" ? composeFront(model, assets) : composeBack(model, assets);

  // the artwork (with the bg rect already filling 0..W/0..H) is shifted so its bg
  // extends into the bleed by scaling the bg via an outer group? simpler: redraw the
  // bg to cover the bleed, then place body on top — body's own bg rect is hidden under
  // nothing, so instead we just enlarge the viewport and let a bleed-bg sit beneath.
  const markGap = opts.marks ? 4 : 0; // quiet zone for crop marks
  const minX = -(bleed + markGap);
  const minY = -(bleed + markGap);
  const vbW = W + 2 * (bleed + markGap);
  const vbH = H + 2 * (bleed + markGap);

  // bleed background: repeat the body's base colour out to the bleed edge
  const bleedBg =
    bleed > 0
      ? `<rect x="${-bleed}" y="${-bleed}" width="${W + 2 * bleed}" height="${H + 2 * bleed}" fill="${
          side === "front" ? "#ffffff" : PALETTE[accentIndexForSeed(model.seed)]
        }"/>`
      : "";

  // clip the artwork to the bleed rectangle (oversized rings shouldn't spill into marks)
  const clipId = `bc-${side}-clip`;
  const clip = `<clipPath id="${clipId}"><rect x="${-bleed}" y="${-bleed}" width="${W + 2 * bleed}" height="${
    H + 2 * bleed
  }"/></clipPath>`;

  const marks = opts.marks ? cropMarks(bleed) : "";

  // embedded Inter (SVG-as-<img> + print can't see page web-fonts) — see useEmbeddedFont
  const fontStyle = assets.fontCss ? `<style>${assets.fontCss}</style>` : "";

  // px sizing (high-res texture) vs physical mm (print export)
  const wAttr = opts.px ? `${f(vbW * opts.px)}` : `${f(vbW)}mm`;
  const hAttr = opts.px ? `${f(vbH * opts.px)}` : `${f(vbH)}mm`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${wAttr}" height="${hAttr}" viewBox="${f(
    minX,
  )} ${f(minY)} ${f(vbW)} ${f(vbH)}"><defs>${fontStyle}${clip}</defs><g clip-path="url(#${clipId})">${bleedBg}${body}</g>${marks}</svg>`;
}

/* crop / trim marks at the four corners, sitting in the bleed margin */
function cropMarks(bleed: number): string {
  const len = 3;
  const off = bleed + 0.5; // start just outside the trim
  const corners: string[] = [];
  const mk = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#000" stroke-width="0.12"/>`;
  // four corners × (horizontal + vertical) marks
  const cs = [
    [0, 0, -1, -1],
    [W, 0, 1, -1],
    [0, H, -1, 1],
    [W, H, 1, 1],
  ];
  for (const [cx, cy, sx, sy] of cs) {
    corners.push(mk(cx + sx * off, cy, cx + sx * (off + len), cy));
    corners.push(mk(cx, cy + sy * off, cx, cy + sy * (off + len)));
  }
  return `<g>${corners.join("")}</g>`;
}

/** Convenience: both faces as high-res textures (no bleed/marks) for the 3D card. */
export function buildFaces(
  model: CardModel,
  assets: FaceAssets,
  px = 12,
): { front: string; back: string } {
  return {
    front: buildFace("front", model, assets, { px }),
    back: buildFace("back", model, assets, { px }),
  };
}
