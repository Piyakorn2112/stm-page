/**
 * bloomCodeCore — the STM "Bloom Code" v4: the whole disc is data, the bloom signs it
 * from the corner. Anatomy:
 *
 *   • SIX DATA ORBITS, 24 slots each — moving the bloom out of the centre freed the
 *     middle of the disc, and the density goes to data: 144 positions (was 96). Every
 *     slot carries ink (dash = 1, dot = 0, runs merge); the centre is calm negative
 *     space — where the flower used to be.
 *   • THE BLOOMING ORBITS — the signature, kept from v3: all orbits ride one radial
 *     wave r(θ) = r₀ + WAVE_AMP·cos(fold·θ) in the corner bloom's own fold. No other
 *     circular code undulates; the disc is a flower in cross-section.
 *   • THE CORNER BLOOM — the brand flower, scaled to 0.4 and nestled into the disc's
 *     lower-right edge like a maker's seal. Three outer-orbit slots are reserved as a
 *     NOTCH so the field visibly makes room for it: integrated, not floating. It
 *     plays no role in registration or decoding — it signs (soft shape-match) only.
 *   • THE CHARGE SPARK — one data mark drawn in THE BLOOM'S OWN PRIMARY (the palette
 *     colour its charge is built on — recovered deterministically from the hover),
 *     at position (payload mod positions): each id's charge frozen at its own moment,
 *     in its own colour.
 *   • NO REGISTRATION CIRCLE — v4 removes the last non-data stroke. The outermost
 *     orbit IS the registration feature: ray-cast outermost-thin-run + median trim
 *     fits centre/scale from the marks themselves (the wave is zero-mean, so the fit
 *     is unbiased), and the reader's per-ring offset + wave fit absorbs the residual.
 *
 * CODEC v4 (self-contained — ringCodeCore is no longer involved):
 *   payload 24 bits (16.7M ids) + version bit + CRC-6 checksum → 31 data bits → 8
 *   Hamming(7,4) nibbles → 56-bit frame, WHITENED, written ~2.5× across the 141
 *   usable positions via frameBitAt = (slot + 9·ring) mod 56 — copies of every bit
 *   land on different rings ≥135° apart (every bit keeps ≥2 copies even after the
 *   notch). Three layers of protection: per-nibble Hamming corrects bit flips, the
 *   interleaved copies + erasure channel survive occlusion, and the CRC is an
 *   explicit checksum gating every orientation candidate (v3 relied on re-encode
 *   agreement alone).
 *
 * ORIENTATION stays v3's markerless model: the decoder tests all 24 rotations × 2
 * mirrorings through the codec; rotation-safe, flip-safe, nothing to take hostage.
 *
 * LAYERING: stmRingCore (brand geometry, UNTOUCHED, read-only imports) → THIS
 * (codec + layout + render) → bloomScanner (the optical decoder).
 */

import {
  centreLine,
  CX,
  CY,
  exportThumbnailSVG,
  hexToOklab,
  makeHover,
  PALETTE,
  SETTLE_POSE,
  STROKE,
  VIEW_W,
} from "./stmRingCore";

// ---- Bloom-code geometry (single source of truth; the scanner imports this) -----
export const BLOOM = {
  CAN: 320, // square canvas (flower units)
  C: 160, // centre (CAN/2)
  // 6 orbits filling the disc. Orbit 0 is THE SOURCE RING — one continuous unbroken
  // stroke (same gauge, same wave) that the beaded field grows from: it grounds the
  // composition visually AND is the position indicator (a thick continuous closed
  // curve pins centre, scale and tilt better than any added marker, at any size).
  // Orbits 1–5 carry the data.
  RINGS: [60.5, 72.5, 84.5, 96.5, 108.5, 120.5] as const,
  N_SLOTS: 24, // angular slots/orbit (15° each)
  // dash body fill per ring (index 0 unused — the source ring is continuous);
  // inner orbits have shorter arcs, so their dashes fill less of the slot
  SLOT_FILLS: [0, 0.46, 0.5, 0.52, 0.52, 0.52] as const,
  DOT_W: 6.6, // mark stroke weight (dash stroke = dot diameter)
  EDGE_OFF: 0.3, // decoder edge probes at ±0.30·slot — inside a dash, clear of a dot
  WAVE_AMP: 4.2, // the blooming-orbit wave (shared by all orbits ⇒ gaps preserved)

  // corner bloom — the maker's seal, nestled into the disc's lower-right edge
  // its centre's distance from the disc centre, along +45° — close enough that the
  // seal's edge reaches INTO the outer orbit's band (ink starts at ~117.6 > ring-4's
  // max reach 116), so it reads as nestled in the notch, not floating beside the disc
  BLOOM_DIST: 146,
  BLOOM_ANG: Math.PI / 4, // bottom-right (SVG y grows downward)
  // Footprint is held constant (FIT_R·SCALE ≈ 28.4) so the corner seal occupies the
  // SAME space at every fold; the wider FIT_R (76, to admit 5/6-fold rosettes) is paid
  // back by the smaller scale, so nothing overlaps the orbits and the notch is unchanged.
  BLOOM_SCALE: 0.374, // flower drawn at 0.374× ⇒ ink radius ≤ ~28.4 (FIT_R·scale)
  CENTRE_R: 78, // canonical bloom-patch radius (≥ FIT_R so the widest rosette is framed)
};
export const LAYERS = BLOOM.RINGS.length;
export const SOURCE_RING = 0; // the continuous orbit — no data
export const DATA_RINGS = LAYERS - 1; // orbits 1..5
export const GRID_POS = DATA_RINGS * BLOOM.N_SLOTS; // 120 positions (117 usable)
// Registration reference: the fitted circle lands on the outer orbit's outer edge.
export const FIT_REF_R = BLOOM.RINGS[LAYERS - 1] + BLOOM.DOT_W / 2;
// The NOTCH: outer-orbit slots the corner bloom occupies — reserved, never drawn,
// never voted (the field makes room for the seal).
export const NOTCH_RING = LAYERS - 1;
export const NOTCH_SLOTS = [2, 3, 4] as const; // 30°/45°/60° — straddling +45°
export const isReserved = (ring: number, slot: number): boolean =>
  ring === NOTCH_RING && slot >= NOTCH_SLOTS[0] && slot <= NOTCH_SLOTS[NOTCH_SLOTS.length - 1];
export const FOLDS = [3, 4, 5, 6] as const; // allowed bloom symmetry orders

// The wave plays the bloom's fold — or its OCTAVE: odd folds split between the
// original wave (3, 5) and the doubled one (6, 10) by a payload bit, so both
// variants live in the family. (Odd-fold waves have a subtle hazard — cos3θ contains
// a cosθ term, so a centre ~3·WAVE_AMP off genuinely concentrates the radial profile,
// a false registration optimum measured at 13–22px. The calyx anchor makes that
// optimum unreachable: the centre is pinned before any radial scoring runs.)
export const waveFoldFor = (fold: number, payload: number): number =>
  fold % 2 === 0 ? fold : payload % 2 === 0 ? fold : fold * 2;

const f2 = (v: number) => v.toFixed(2);

// =========================================================================
// Codec v4 — payload ↔ 56-bit whitened frame (CRC-6 + Hamming(7,4) + interleave)
// =========================================================================
export const PAYLOAD_BITS = 24;
export const MAX_PAYLOAD = 2 ** PAYLOAD_BITS - 1; // 16,777,215 ids
const VERSION_BITS = 1;
const CRC_BITS = 6;
const DATA_BITS = VERSION_BITS + PAYLOAD_BITS + CRC_BITS; // 31 → padded to 32
const N_NIBBLES = 8;
export const FRAME_BITS = N_NIBBLES * 7; // 56

const toBits = (value: number, width: number): number[] => {
  const out: number[] = [];
  for (let i = width - 1; i >= 0; i--) out.push((value >>> i) & 1);
  return out;
};
const fromBits = (bits: number[]): number => bits.reduce((a, b) => a * 2 + b, 0);

// CRC-6 (x⁶+x+1), MSB-first over [version|payload]. The explicit checksum the
// earlier versions lacked: every orientation candidate must pass it before it can
// even compete on frame agreement.
function crc6(bits: number[]): number {
  let reg = 0;
  for (const b of bits) {
    const fb = ((reg >> 5) & 1) ^ b;
    reg = ((reg << 1) & 0x3f) ^ (fb ? 0x03 : 0);
  }
  return reg;
}

// Hamming(7,4): 4 data bits → 7 code bits (corrects any single-bit error).
const hammingEncode = (d: number[]): number[] => {
  const [d0, d1, d2, d3] = d;
  const p1 = d0 ^ d1 ^ d3;
  const p2 = d0 ^ d2 ^ d3;
  const p4 = d1 ^ d2 ^ d3;
  return [p1, p2, d0, p4, d1, d2, d3];
};
const hammingDecode = (c: number[]): number[] => {
  const b = c.slice();
  const s1 = b[0] ^ b[2] ^ b[4] ^ b[6];
  const s2 = b[1] ^ b[2] ^ b[5] ^ b[6];
  const s4 = b[3] ^ b[4] ^ b[5] ^ b[6];
  const syn = s1 + (s2 << 1) + (s4 << 2);
  if (syn >= 1 && syn <= 7) b[syn - 1] ^= 1;
  return [b[2], b[4], b[5], b[6]];
};

/** Payload → the 56-bit ECC frame (UNwhitened; whitening happens at the grid). */
export function encodeFrameBits(payload: number, version = 0): number[] {
  if (payload < 0 || payload > MAX_PAYLOAD) throw new RangeError(`payload must be 0..${MAX_PAYLOAD}`);
  const vp = [...toBits(version, VERSION_BITS), ...toBits(payload, PAYLOAD_BITS)];
  const data = [...vp, ...toBits(crc6(vp), CRC_BITS)];
  while (data.length < N_NIBBLES * 4) data.push(0);
  const code: number[] = [];
  for (let n = 0; n < N_NIBBLES; n++) code.push(...hammingEncode(data.slice(n * 4, n * 4 + 4)));
  return code;
}

/** 56 read frame bits → {payload, version, crcOk} (Hamming-corrected, CRC-checked). */
export function decodeFrameBits(fb: number[]): { payload: number; version: number; crcOk: boolean } {
  const data: number[] = [];
  for (let n = 0; n < N_NIBBLES; n++) data.push(...hammingDecode(fb.slice(n * 7, n * 7 + 7)));
  const version = fromBits(data.slice(0, VERSION_BITS));
  const payload = fromBits(data.slice(VERSION_BITS, VERSION_BITS + PAYLOAD_BITS));
  const crc = fromBits(data.slice(VERSION_BITS + PAYLOAD_BITS, DATA_BITS));
  const crcOk = crc === crc6(data.slice(0, VERSION_BITS + PAYLOAD_BITS));
  return { payload, version, crcOk };
}

// Which frame bit a (ring, slot) cell carries: −1 for non-data cells (source ring,
// notch); otherwise usable positions are numbered ring-major SKIPPING the reserved
// cells and the bit is (index mod 56) — 117 usable = 56×2 + 5, so every bit gets
// exactly 2 copies (bits 0–4 get 3), ~56 positions ≈ 2 rings + 8 slots (120°+) apart
// on different rings. Formula-with-offset schemes were tried and leave single-copy
// bits once the notch bites; compact numbering cannot.
export const frameBitAt = (() => {
  const table: number[][] = Array.from({ length: LAYERS }, () =>
    new Array(BLOOM.N_SLOTS).fill(-1),
  );
  let idx = 0;
  for (let ring = 1; ring < LAYERS; ring++) {
    for (let slot = 0; slot < BLOOM.N_SLOTS; slot++) {
      if (isReserved(ring, slot)) continue;
      table[ring][slot] = idx % FRAME_BITS;
      idx++;
    }
  }
  return (ring: number, slot: number): number => table[ring][slot];
})();

// WHITENING — the wire never carries the raw frame (XORed both ways). Without it,
// degenerate payloads render monotone fields AND misaligned all-dot/all-dash reads
// decode with perfect self-consistency (v3 observed a conf-1.0 false id 0).
export const WHITEN: number[] = (() => {
  let x = 0x5827e0;
  const out: number[] = [];
  for (let i = 0; i < FRAME_BITS; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out.push((x >> 16) & 1);
  }
  return out;
})();

/**
 * Payload → the LAYERS×N_SLOTS grid: 1 = dash, 0 = dot, −1 = reserved notch cell
 * (not drawn, not data). Every non-reserved cell carries ink.
 */
export function encodeBloomGrid(payload: number): number[][] {
  const fb = encodeFrameBits(payload);
  return Array.from({ length: LAYERS }, (_, ring) =>
    Array.from({ length: BLOOM.N_SLOTS }, (_, slot) => {
      const b = frameBitAt(ring, slot);
      if (b < 0) return -1; // source ring / notch — not data
      return (fb[b] || 0) ^ WHITEN[b];
    }),
  );
}

/** The charge spark's cell for a payload — over usable (non-reserved) positions. */
export const sparkPos = (payload: number): { ring: number; slot: number } => {
  const usable = GRID_POS - NOTCH_SLOTS.length; // 117
  let p = payload % usable;
  for (let ring = 1; ring < LAYERS; ring++) {
    for (let slot = 0; slot < BLOOM.N_SLOTS; slot++) {
      if (frameBitAt(ring, slot) < 0) continue;
      if (p === 0) return { ring, slot };
      p--;
    }
  }
  return { ring: 1, slot: 0 }; // unreachable
};

export type BloomSeed = { k: number; fold: number; seed: string };

const FIT_R = 76; // wire reach bound; admits the fuller 5/6-fold rosettes (those cluster 71–76)

// Geometry of a candidate bloom at the settle pose, all measured off the one
// closed wire (CX,CY-centred). Deterministic — encoder and verifier always agree.
// 200 samples: fine enough that `curv` (a second difference) is stable, so the
// aesthetic gate's thresholds are sample-rate independent.
type BloomGeom = { fold: number; fits: boolean; fill: number; curv: number };
function bloomGeom(seed: string): BloomGeom {
  const h = makeHover(seed);
  const { px, py } = centreLine(SETTLE_POSE.t, SETTLE_POSE.twistT, SETTLE_POSE.morph, h, 200);
  const n = px.length;
  const lim = (FIT_R - STROKE / 2) ** 2; // max reach + half wire ≤ FIT_R: never spills the footprint
  let fits = true, rsum = 0, rmax = 0, curv = 0;
  for (let i = 0; i < n; i++) {
    const dx = px[i] - CX, dy = py[i] - CY, d2 = dx * dx + dy * dy;
    if (d2 > lim) fits = false;
    const d = Math.sqrt(d2);
    rsum += d; if (d > rmax) rmax = d;
  }
  // peak |second difference| of the outline — the stroke's sharpest kink.
  for (let i = 0; i < n; i++) {
    const cx2 = px[(i - 2 + n) % n] - 2 * px[i] + px[(i + 2) % n];
    const cy2 = py[(i - 2 + n) % n] - 2 * py[i] + py[(i + 2) % n];
    const c = Math.hypot(cx2, cy2); if (c > curv) curv = c;
  }
  return { fold: h.twist.sym, fits, fill: rmax > 0 ? rsum / n / rmax : 1, curv };
}

// The aesthetic gate, derived from the owner's prefer / not-prefer reference set:
//   · FILL = mean/max radius. A bare single loop sits near-circular (≈0.85–0.97) and
//     reads as one lonely ring (a "not prefer"). A real bloom dips inward to form
//     petals, so its fill is moderate. Cap it to reject the bare ring.
//   · CURV caps the sharpest kink to reject spiky / loose stars. Curvature grows with
//     the fold (more lobes ⇒ tighter turns), so the cap scales with the fold — a clean
//     6-fold rosette is naturally curvier than a clean 3-fold without being spiky.
const FILL_MAX = 0.83;
const FILL_MIN = 0.5;
const CURV_PER_FOLD = 1.6;
const isRoundedBloom = (g: BloomGeom) =>
  g.fits && g.fill <= FILL_MAX && g.fill >= FILL_MIN && g.curv <= CURV_PER_FOLD * g.fold;

/**
 * Deterministically pick the bloom shape for a payload, biased to the owner's taste:
 * the first seed in the `bloomcode:<payload>:<k>` family that is a clean rounded
 * flower in a PREFERRED fold (5 or 6 — the full rosettes). Lower folds are taken only
 * as fallbacks: 3-fold is negatively biased (the brand triangle, fine but no longer the
 * default), then the 4-fold (its rosette can read as the disliked rigid square), then
 * any ungated fitting seed as a last resort so every id always resolves.
 * Replayable: a decoder recomputes the same shape + fold from the recovered payload.
 * The CODE's wave logic is unchanged — `waveFoldFor` still maps the chosen fold onto
 * the orbits, and every resulting wave fold is already in MODEL_FS/TILT_WAVE_FS.
 */
export function bloomSeed(payload: number): BloomSeed {
  let three: BloomSeed | null = null; // negatively-biased 3-fold fallback
  let four: BloomSeed | null = null;  // 4-fold fallback (squarer rosette)
  let any: BloomSeed | null = null;   // last resort: any fitting fold 3–6
  for (let k = 0; k < 400; k++) {
    const seed = `bloomcode:${payload}:${k}`;
    const g = bloomGeom(seed);
    if (!g.fits || g.fold < 3 || g.fold > 6) continue;
    if (isRoundedBloom(g) && (g.fold === 5 || g.fold === 6)) return { k, fold: g.fold, seed };
    if (isRoundedBloom(g) && g.fold === 3 && !three) three = { k, fold: g.fold, seed };
    if (isRoundedBloom(g) && g.fold === 4 && !four) four = { k, fold: g.fold, seed };
    if (!any) any = { k, fold: g.fold, seed };
  }
  return three ?? four ?? any ?? { k: 0, fold: 0, seed: `bloomcode:${payload}:0` };
}

/**
 * The bloom's PRIMARY brand colour — the palette entry its charge palette is built
 * on. `makeHover` stores the charge primary at the palette colour's exact OKLab hue,
 * so the nearest-hue palette entry recovers the index deterministically.
 */
export function bloomPrimary(payload: number): string {
  const hover = makeHover(bloomSeed(payload).seed);
  const p = hover.charge.primary;
  const hue = Math.atan2(p.b, p.a);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const l = hexToOklab(PALETTE[i]);
    let d = Math.abs(Math.atan2(l.b, l.a) - hue) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bestD) { bestD = d; best = i; }
  }
  return PALETTE[best];
}

// ---- blooming-orbit geometry helpers ----------------------------------------
const waveR = (r0: number, theta: number, fold: number): number =>
  r0 + BLOOM.WAVE_AMP * Math.cos(fold * theta);

// A mark-weight polyline riding the wave from angle a0 to a1 (round caps + joins).
function waveDash(r0: number, a0: number, a1: number, fold: number, color: string): string {
  const STEP = Math.PI / 96;
  let d = "";
  for (let a = a0; ; a += STEP) {
    const t = Math.min(a, a1);
    const r = waveR(r0, t, fold);
    d += `${d ? "L" : "M"}${f2(BLOOM.C + r * Math.cos(t))},${f2(BLOOM.C + r * Math.sin(t))}`;
    if (t >= a1) break;
  }
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f2(BLOOM.DOT_W)}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function waveDot(r0: number, a: number, fold: number, color: string): string {
  const r = waveR(r0, a, fold);
  return (
    `<circle cx="${f2(BLOOM.C + r * Math.cos(a))}" cy="${f2(BLOOM.C + r * Math.sin(a))}" ` +
    `r="${f2(BLOOM.DOT_W / 2)}" fill="${color}"/>`
  );
}

export type BloomOpts = {
  size?: number;
  background?: string;
  grayscaleFlower?: boolean;
  ink?: string; // colour of the data marks (keep dark — the scanner reads luminance)
  spark?: string; // override the spark colour (defaults to the bloom's own primary)
  flower?: boolean; // draw the corner bloom seal (default true; additive no-op for existing callers)
};

/** The brand bloom, centred + canonical, with no code around it — the match reference. */
export function bloomCentreSVG(payload: number, size: number, grayscale = false): string {
  const { seed } = bloomSeed(payload);
  const inner = exportThumbnailSVG(seed, VIEW_W, grayscale)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  const R = BLOOM.CENTRE_R;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="${f2(BLOOM.C - R)} ${f2(BLOOM.C - R)} ${f2(2 * R)} ${f2(2 * R)}">` +
    `<rect x="${f2(BLOOM.C - R)}" y="${f2(BLOOM.C - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" fill="#fff"/>` +
    `<g transform="translate(${f2(BLOOM.C - CX)},${f2(BLOOM.C - CY)})">${inner}</g></svg>`
  );
}

/** Encode a payload into the full Bloom Code SVG (orbits + corner bloom + spark). */
export function encodeBloomSVG(payload: number, opts: BloomOpts = {}): string {
  if (payload < 0 || payload > MAX_PAYLOAD) throw new RangeError(`payload must be 0..${MAX_PAYLOAD}`);
  const ink = opts.ink ?? "#111111";
  const spark = opts.spark ?? bloomPrimary(payload);
  const size = opts.size ?? BLOOM.CAN;

  // Corner bloom (the seal) — scaled and nestled into the notch; its fold drives the wave.
  // Optional: callers that just want the orbit code (no brand flower) pass flower:false.
  const { seed, fold } = bloomSeed(payload);
  const wf = waveFoldFor(fold, payload);
  let body = "";
  if (opts.flower !== false) {
    const flower = exportThumbnailSVG(seed, VIEW_W, opts.grayscaleFlower ?? false)
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "");
    const s = BLOOM.BLOOM_SCALE;
    const bx = BLOOM.C + BLOOM.BLOOM_DIST * Math.cos(BLOOM.BLOOM_ANG);
    const by = BLOOM.C + BLOOM.BLOOM_DIST * Math.sin(BLOOM.BLOOM_ANG);
    body = `<g transform="translate(${f2(bx - s * CX)},${f2(by - s * CY)}) scale(${f2(s)})">${flower}</g>`;
  }

  // The source ring — orbit 0, one unbroken stroke on the same wave: the line the
  // field grows from, and the scanner's anchor. (Closed wavy path, full turn.)
  {
    const r0 = BLOOM.RINGS[SOURCE_RING];
    const STEP = Math.PI / 96;
    let d = "";
    for (let a = 0; a <= 2 * Math.PI + 1e-9; a += STEP) {
      const r = r0 + BLOOM.WAVE_AMP * Math.cos(wf * a);
      d += `${d ? "L" : "M"}${f2(BLOOM.C + r * Math.cos(a))},${f2(BLOOM.C + r * Math.sin(a))}`;
    }
    body += `<path d="${d} Z" fill="none" stroke="${ink}" stroke-width="${f2(BLOOM.DOT_W)}" stroke-linejoin="round"/>`;
  }

  // Data orbits riding the bloom's wave. Runs merge; they split around the spark so
  // it reads as its own coloured segment; notch cells stay empty for the seal.
  const grid = encodeBloomGrid(payload);
  const sp = sparkPos(payload);
  const slotAng = (2 * Math.PI) / BLOOM.N_SLOTS;
  for (let ring = 1; ring < LAYERS; ring++) {
    const r0 = BLOOM.RINGS[ring];
    const half = (BLOOM.SLOT_FILLS[ring] * slotAng) / 2;
    for (let s2 = 0; s2 < BLOOM.N_SLOTS; s2++) {
      if (grid[ring][s2] !== 0) continue;
      const isSpark = ring === sp.ring && s2 === sp.slot;
      body += waveDot(r0, s2 * slotAng, wf, isSpark ? spark : ink);
    }
    let s2 = 0;
    while (s2 < BLOOM.N_SLOTS) {
      if (grid[ring][s2] !== 1 || (ring === sp.ring && s2 === sp.slot)) { s2++; continue; }
      let e = s2;
      while (e + 1 < BLOOM.N_SLOTS && grid[ring][e + 1] === 1 && !(ring === sp.ring && e + 1 === sp.slot)) e++;
      body += waveDash(r0, s2 * slotAng - half, e * slotAng + half, wf, ink);
      s2 = e + 1;
    }
    if (ring === sp.ring && grid[ring][sp.slot] === 1) {
      body += waveDash(r0, sp.slot * slotAng - half, sp.slot * slotAng + half, wf, spark);
    }
  }

  const bg = opts.background ? `<rect width="100%" height="100%" fill="${opts.background}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f2(size)}" height="${f2(size)}" ` +
    `viewBox="0 0 ${BLOOM.CAN} ${BLOOM.CAN}">${bg}${body}</svg>`
  );
}

/** Brand accent colour for a payload (used by the reveal UI). */
export function accentFor(payload: number): string {
  return PALETTE[payload % PALETTE.length];
}
