"use client";

/**
 * StructureGrid — a production-minded variant of <HeroGrid/> for a real landing
 * hero. Same engine and the same glitch-free static → morph → static path, but
 * tuned to be the FIELD AROUND a big centred hero ring rather than the show.
 *
 * LAYOUT — Apple-Watch-style spherical honeycomb (สลับฟันปลา).
 * The field is NOT a flat CSS grid. Cell centres sit on a STAGGERED hex lattice
 * (offset rows ⇒ every cell has six equal neighbours — the triangulated, fish-
 * tooth packing), which is then PROJECTED THROUGH A SPHERE so it reads like the
 * face of a globe centred on the hero ring:
 *
 *   • a flat lattice point at radius `r` from the focal centre is treated as an
 *     arc of a sphere of radius `sphereR`, i.e. polar angle  φ = r / sphereR ;
 *   • it lands on screen at  sphereR·sin φ  (orthographic limb) — so SPACING
 *     COMPRESSES with distance (d/dr of sinφ = cosφ): the honeycomb packs ever
 *     tighter toward the rim, exactly like the edge of a globe;
 *   • each ring is DRAWN at  cos(φ)^γ  of its base size (spherical foreshorten-
 *     ing) — so the cells hugging the hero are big and they taper smoothly out.
 *
 * Because both the local radial spacing AND the ring size scale by cos φ, the
 * fill ratio RING/PITCH is constant across the whole field ⇒ it is collision-
 * free at every φ (the honeycomb just shrinks, Apple-Watch style). γ ≥ 1 only
 * ever opens MORE gap at the rim, so it stays safe. Verified over several
 * viewports (min radial gap > 5px everywhere).
 *
 * As before the field still:
 *   • GIVES WAY in the centre to the big hero ring (cells whose projected centre
 *     falls inside the ring's clearing aren't rendered — see RING_GEOM, shared
 *     with the page), and
 *   • leaves the bottom clear for the tagline (cells in the white bottom band
 *     aren't rendered; the page fades the rest to white), with an optional
 *     hard-edged reserve rectangle to keep the top-left logo clear.
 *
 * ENTRANCE + REACTION (opt-in, driven by StructureScene through a ref handle —
 * no-op when rendered standalone). Each cell carries `distC` (its distance from
 * the hero centre, precomputed = the sphere projection radius). On `bloomIn()`
 * the field springs outward from the centre: cells fade+scale in with a small
 * overshoot, staggered by `distC` so the bloom flows out from the ring's edge —
 * done purely with CSS classes + a per-cell delay var, so React re-renders
 * (live morphs settling) never interrupt it. `waveTo(true|false)` waves the field
 * to/from a COMPRESSED state (each cell shrinks + slides a little toward the
 * centre and HOLDS, then releases) — a per-cell CSS transform-transition with a
 * `distC`-based delay, so the change sweeps out from the centre on the compositor
 * thread (no React, no per-frame main-thread work). Both honour prefers-reduced-
 * motion via the orchestrator.
 *
 * The page's fades are white-on-white gradient overlays (background is pure
 * white), so there are no CSS masks here. HeroGrid is untouched; this is an
 * additive sibling.
 */

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MorphRing, DARK_BASE, exportThumbnailSVG, R_MID, randomSeed, STROKE, VIEW_H, VIEW_W } from "@stm-ring";
import { LIGHT_THEME, type StructureTheme } from "./structureTheme";

// ── Spherical honeycomb tunables ──────────────────────────────────────────
const PITCH = 112; // base hex pitch (px) at the focal centre
const RING = 102; // base ring size (px) at the centre; < PITCH ⇒ never collides
// PITCH & RING scale together (fill ratio ≈ 0.91 is collision-free at any φ); bumped
// up so the rings in CLOSE PROXIMITY to the hero read large (~94px) — the field
// taper (SIZE_GAMMA) then keeps the rim rings small. Bigger rings pack looser ⇒
// fewer of them overall, which is the intended trade for the bold near-centre look.
const ROW_PITCH = (PITCH * Math.sqrt(3)) / 2; // staggered row height (hex packing)
// Curvature of the projection: the FARTHEST screen corner is mapped to this
// ring scale, which fixes the sphere's polar angle there (and hence sphereR per
// viewport). Smaller ⇒ stronger fisheye (bigger centre-to-rim size contrast).
const CORNER_SCALE = 0.34;
const EDGE_PHI = Math.acos(CORNER_SCALE);
// Size falloff exponent — the "difference curve". 1 = pure sphere (packed
// honeycomb everywhere). Higher cranks the contrast: the centre stays full size
// (cos0 = 1) while rim rings shrink ever faster, so the centre reads much bigger
// than the edges. This only ADDS gap at the rim, never removes it ⇒ always
// collision-free. 1.6 ≈ 4.4× centre-to-rim size ratio (was ~2.8× at 1.1).
const SIZE_GAMMA = 1.6;
const MIN_DRAW = 13; // cull rings that would render tinier than this (px)
const SCREEN_MARGIN = 48; // keep cells whose centre is within this of the edge

const POOL = 140; // distinct static shapes (seeds), tiled across the field
const MAX_LIVE = 4; // concurrent morphing rings (few = calm, premium)
const BATCH = 1; // how many start morphing per tick
const ACTIVATE_MS = 1500; // gentle cadence
const MORPH_MS = 1600; // duration of a single static → morph → static transition

// ── Dynamic ring resolution ────────────────────────────────────────────────
// A ring's detail is invisible once it is small, so smaller cells render with
// fewer strand segments — far cheaper to rasterise AND to morph per-frame. The
// level is picked from the cell's DRAWN size; buckets keep the clean ~4:1
// segment:piece ratio. The static thumbnail and the live morph for a cell share
// its level (`resFor(draw)`), so the static↔morph handoff stays seamless. The
// levels overlap gently in size so the change across the field is imperceptible.
type Res = { min: number; seg: number; pc: number };
const RES_LEVELS: Res[] = [
  { min: 46, seg: 160, pc: 40 }, // the big cells hugging the hero
  { min: 34, seg: 124, pc: 31 },
  { min: 25, seg: 92, pc: 23 },
  { min: 0, seg: 64, pc: 16 }, // the tiny rim cells
];
const resFor = (draw: number): Res => RES_LEVELS.find((l) => draw >= l.min) ?? RES_LEVELS[RES_LEVELS.length - 1];

// ── Entrance bloom (springs out from the centre) ──────────────────────────
// SPRING_SPEED is deliberately gentle: a slow wavefront spreads the per-cell
// transitions over a longer window so FEW cells animate (and promote to a GPU
// layer) at the same instant — lower peak cost on mobile.
const SPRING_SPEED = 0.62; // px/ms the bloom wavefront travels outward (sets stagger).
// Slowed from 0.9 ⇒ the reveal window is ~1.45× longer, so the per-cell fades are
// spread over more time and FEWER cells bloom (+ promote a GPU layer) at the same
// instant — lower peak load. The hero RING reveal (BLOOM_MS in StructureHeroRing)
// is unchanged; only the grid's wavefront is gentler.
const SPRING_MS = 620; // per-cell fade+scale duration
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // easeOutBack — small overshoot

// ── Reaction wave (the hero morphs into a shape ⇒ the field pulls IN + shrinks
// and HOLDS, then releases when the ring comes back to the circle) ──────────
// NOT a transient pulse: `waveTo(true)` transitions every cell to a COMPRESSED
// transform (shrunk + nudged toward the centre) and it HOLDS there; `waveTo(false)`
// transitions back. Both ride a per-cell CSS `transition-delay = distC / WAVE_SPEED`
// so the change sweeps out from the centre on the COMPOSITOR thread — no
// main-thread per-frame work. WAVE_DUR sets the wavefront width; the easeOutBack
// gives compress/release a gentle bounce (responsive, springy — not a flat glide).
// SLOW sweep on purpose: the stagger range (maxDistC / WAVE_SPEED) is now ~2× the
// per-cell WAVE_DUR, so the wave is a MOVING BAND, not all-at-once — far fewer
// cells animate (and promote a compositor layer) at the same instant, which kills
// the concurrent-animation stutter AND makes the wave visibly sweep (expressive).
const WAVE_SPEED = 0.38; // px/ms — outward sweep speed (delay stagger). Lower than
// before ⇒ the wavefront band is narrower, so FEWER cells animate (and promote a
// compositor layer) at the same instant — the concurrent-scaling spike that was
// starving the canvas hero of frames is spread over more time. Preserves the look.
const WAVE_DUR = 1000; // ms — per-cell transition; long ⇒ silky
// Spring feel done RIGHT: like a real spring, the motion starts from REST (y1=0 ⇒
// gentle ease-IN, no jolt — unlike easeOutBack, which launches at slope ≈ y1/x1
// and stutters), OVERSHOOTS (y2>1 ⇒ the bounce), then SETTLES gently. Tuned
// smoother at BOTH ends than before: x2 raised (0.2→0.3) spreads the rise so it's
// not a mid-jerk, and the overshoot is trimmed (1.4/1.6 → 1.32/1.46) so it eases
// back in instead of snapping — while still clearly bouncy. Release pops a touch
// harder than compress. (Raise y2 for more bounce; lower x2 for a gentler settle.)
// Single compositor transition, so the bounce never stutters.
const WAVE_EASE_COMPRESS = "cubic-bezier(0.28, 0, 0.3, 1.32)";
const WAVE_EASE_RELEASE = "cubic-bezier(0.28, 0, 0.3, 1.46)";
const WAVE_SCALE = 0.7; // compressed scale — DRAMATIC shrink (was 0.84)
// Inward pull (translate toward centre) is STRONGEST near the hero and DEGRADES
// with distance: pull(px) = PULL_MAX · exp(-distC / PULL_DECAY). So the cells
// hugging the ring get sucked in; the rim moves less.
const PULL_MAX = 54; // px pull at the centre — more convergence (was 42)
const PULL_DECAY = 420; // px falloff scale — bigger ⇒ the pull reaches further out
// Reactive radius: cells beyond REACT_R (with a REACT_FADE soft edge) sit STILL
// during the wave — no transform ⇒ no layer promotion. Set generously so a NORMAL
// viewport reacts fully (dramatically); only a very large screen's far-rim rings
// (the bulk of the count) idle, capping the wave's cost there.
const REACT_R = 950; // px from the hero centre — full reaction within (minus the fade).
// Tightened so a LARGE screen's far-rim rings (the bulk of the count) sit still
// during the wave ⇒ far fewer concurrent layer promotions; a normal viewport
// still reacts essentially fully.
const REACT_FADE = 300; // px soft edge

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// ── Ambient breathing (per-cell, distance-scaled) ───────────────────────────
// The field breathes by drifting each NEAR cell RADIALLY (outward, then back).
// Amplitude FALLS OFF with distance from the hero (smoothstep over BREATHE_SPAN),
// so the rings hugging the hero breathe most and the rim sits still — the
// distance-scaled feel a single container scale CANNOT give (scaling about the
// centre moves the far cells more, not less). Only cells above BREATHE_MIN
// animate (a transform ⇒ a compositor layer), so the layer count is bounded by
// BREATHE_SPAN — narrower ⇒ fewer breathing cells ⇒ cheaper. A per-cell delay
// (by distance) makes it a slow breath flowing outward from the hero.
const BREATHE_MAX_PX = 8; // peak radial drift of the nearest cells (px)
const BREATHE_SPAN = 440; // px past the hole edge where the breath fades to 0 (reaches further out)
const BREATHE_MIN = 0.05; // amplitude factor below which a cell doesn't breathe (no layer)
const BREATHE_PERIOD_MS = 6500; // one full breath (slow)
const BREATHE_WAVE_MS = 1600; // phase spread across the field (flowing breath)

// ── Scripted exit collapse ──────────────────────────────────────────────────
// On the exit each cell SCALES DOWN IN PLACE (no displacement / drift / fall),
// weighted so NEAR cells shrink most — a scale-down emanating FROM THE CENTRE,
// per-cell (not a flat container scale). Far cells (weight→0) keep an identity
// transform ⇒ no layer; the layer fade (parent) carries them off. It's a ONE-SHOT
// CSS transition (class .sg-exit), ambient PAUSED, fully reversible (toggling the
// class back scales them up again).
const COLLAPSE_SPAN = 480; // px past the hole edge over which the per-cell shrink fades to 0
const COLLAPSE_DROP_FRAC = 0; // no downward fall (kept for the target math; 0 ⇒ in place)
const COLLAPSE_PULL = 0; // no inward drift — scale only
const COLLAPSE_SHRINK = 0.85; // a near cell shrinks to (1 - this) = 0.15 (scales away)
// Must match HomeReveal SETTLE_MS / EXIT_MS. The delay is the "settle to ready"
// beat (ambient paused, field still) before the drift begins.
const EXIT_MS = 1100;
const EXIT_DELAY_MS = 220;
const EXIT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Geometry of the big centred hero ring, SHARED with the ring layer
 * (StructureHeroRing sizes the real <StmRing/> and paints the white wash from
 * these same numbers, so the field's clearing always matches the ring on every
 * viewport).
 *   size  = min(vminFrac·min(vw,vh), vhFrac·vh, maxPx)  [vhFrac protects short
 *           landscape screens]; centred horizontally, at cyFrac of the height.
 *   wireFrac = the ring's REST wire outer edge as a fraction of its size — the
 *           field hugs THIS round edge, not the square bounding box, so the
 *           clearing follows the ring. `hugGap` px of white is kept beyond it;
 *           the small rings then fade in over `washSoft`.
 */
export const RING_GEOM = {
  vminFrac: 0.64,
  vhFrac: 0.6,
  maxPx: 580,
  cyFrac: 0.46,
  wireFrac: (R_MID + STROKE / 2) / VIEW_W,
  hugGap: 18,
  washSoft: 44,
};

const BOTTOM_WHITE = 0.9; // below this the field is fully white ⇒ don't render
const BOTTOM_CALM = 0.64; // don't start morphs below this (it's fading out)
const RESERVE_GAP = 6; // extra gap (px) between a rendered ring and `reserve`

// The hero ring's pixel size for a given viewport — exported so the ring layer
// sizes itself from the SAME measurement (window.inner*) the grid uses, instead
// of CSS vmin/vh (which diverges from window.inner* on mobile Safari while the
// address bar animates). Same numbers ⇒ ring and clearing always align.
export const ringSize = (vw: number, vh: number) =>
  Math.min(RING_GEOM.vminFrac * Math.min(vw, vh), RING_GEOM.vhFrac * vh, RING_GEOM.maxPx);
// Clearing radius: small-ring CENTRES kept this far out, so their inner edge
// sits `hugGap` beyond the ring's round wire (RING/2 — the largest, centremost
// cell — accounts for their size).
const holeR = (vw: number, vh: number) =>
  ringSize(vw, vh) * RING_GEOM.wireFrac + RING_GEOM.hugGap + RING / 2;

type Rect = { x: number; y: number; w: number; h: number };
// A projected lattice cell: stable `key` (from its integer hex coords), screen
// centre (sx, sy), drawn size (draw, drawH) and `distC` = its distance from the
// hero centre (= the sphere projection radius; reused for stagger + wave phase).
// `cx`/`cy` are the precomputed inward-pull offset (px) and `waveDelay` the per-
// cell wave delay (ms) — fed to CSS custom properties so the reaction wave is a
// single container-class toggle (the browser sweeps every cell via the cascade).
type Spot = {
  key: number;
  sx: number;
  sy: number;
  draw: number;
  drawH: number;
  distC: number;
  cx: number;
  cy: number;
  cs: number; // compressed scale (1 = idle, for cells beyond the reactive radius)
  waveDelay: number;
  bx: number; // breath peak radial offset x (px); 0 ⇒ this cell doesn't breathe
  by: number; // breath peak radial offset y (px)
  clx: number; // exit-collapse drift toward the hole, x (px) — applied on .sg-exit
  cly: number; // exit-collapse drift toward the hole, y (px)
  csc: number; // exit-collapse target scale (1 = far/static, <1 = near shrinks)
};
type Field = {
  spots: Spot[];
  vw: number;
  vh: number;
  fx: number;
  fy: number;
  hole: number;
  maxDistC: number;
};

/** Imperative handle StructureScene drives for the entrance + reaction. */
export type StructureGridHandle = {
  /** Spring the whole field in from the centre (staggered fade+scale); returns
   *  its total duration in ms (so the caller can wait for it to finish). */
  bloomIn: () => number;
  /** Reveal the field instantly (no animation — used for reduced motion). */
  reveal: () => void;
  /** Wave the field to/from the COMPRESSED state (shrunk + pulled toward centre).
   *  `true` = compress & hold; `false` = release back to normal. Returns the
   *  total sweep duration in ms (so the caller can hold before releasing). */
  waveTo: (compressed: boolean) => number;
};

const EMPTY_FIELD: Field = { spots: [], vw: 0, vh: 0, fx: 0, fy: 0, hole: 0, maxDistC: 0 };

const dataUrl = (svg: string) =>
  `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

// Static thumbnail per (seed, resolution level). Cached so a seed reused across
// cells of the same level is built once; FIFO-capped so a long session of
// settled morphs can't grow it without bound. The SVG carries a viewBox, so one
// thumbnail scales crisply to any cell size — only the segment count differs.
const THUMB_CACHE_CAP = 420;
const thumbCache = new Map<string, string>();
// `baseColors` recolours the rest-wire ramp WITHOUT touching the core: the core
// emits the two known DARK_BASE hexes for the base stops (and nowhere else — the
// charge stops are brand OKLab), so substituting them themes the field's static
// thumbnails for dark mode. Cache key includes the ramp so light/dark don't collide.
const thumbUrl = (
  seed: number,
  seg: number,
  pc: number,
  baseColors: readonly [string, string],
): string => {
  const themed = baseColors[0] !== DARK_BASE[0] || baseColors[1] !== DARK_BASE[1];
  const k = `${seed}:${seg}:${themed ? baseColors[0] : ""}`;
  let u = thumbCache.get(k);
  if (u === undefined) {
    let svg = exportThumbnailSVG(seed, RING, false, seg, pc);
    if (themed) {
      svg = svg.split(DARK_BASE[0]).join(baseColors[0]).split(DARK_BASE[1]).join(baseColors[1]);
    }
    u = dataUrl(svg);
    if (thumbCache.size >= THUMB_CACHE_CAP) {
      const oldest = thumbCache.keys().next().value;
      if (oldest !== undefined) thumbCache.delete(oldest);
    }
    thumbCache.set(k, u);
  }
  return u;
};

// Stable per-cell key from its (col, row) hex coordinates — survives resizes so
// a cell keeps its static look and any completed morph.
const packKey = (col: number, row: number) => (row + 4096) * 16384 + (col + 4096);

// Build the projected spherical honeycomb for a viewport. The lattice is laid
// flat (staggered rows), then each point is wrapped onto a sphere of radius
// `sphereR` and projected to the limb; only on-screen, big-enough cells are kept.
const buildField = (vw: number, vh: number): Field => {
  const fx = vw / 2;
  const fy = vh * RING_GEOM.cyFrac;
  // sphereR fixes the curvature: the farthest screen corner sits at EDGE_PHI.
  const cornerD = Math.max(
    Math.hypot(fx, fy),
    Math.hypot(vw - fx, fy),
    Math.hypot(fx, vh - fy),
    Math.hypot(vw - fx, vh - fy),
  );
  const sphereR = cornerD / Math.sin(EDGE_PHI);
  const hole = holeR(vw, vh);
  const flatMax = sphereR * EDGE_PHI; // flat radius that maps to the corner
  const colN = Math.ceil(flatMax / PITCH) + 1;
  const rowN = Math.ceil(flatMax / ROW_PITCH) + 1;

  const spots: Spot[] = [];
  let maxDistC = 0;
  for (let row = -rowN; row <= rowN; row++) {
    const stagger = (((row % 2) + 2) % 2) === 1 ? PITCH / 2 : 0; // สลับฟันปลา
    const flatY = row * ROW_PITCH;
    for (let col = -colN; col <= colN; col++) {
      const flatX = col * PITCH + stagger;
      const r = Math.hypot(flatX, flatY);
      if (r > flatMax) continue;
      const phi = r / sphereR;
      if (phi >= Math.PI / 2) continue; // past the limb — behind the sphere
      const proj = sphereR * Math.sin(phi); // compressed screen radius = distC
      const scale = Math.cos(phi) ** SIZE_GAMMA; // spherical foreshortening
      const draw = RING * scale;
      if (draw < MIN_DRAW) continue;
      const ang = r === 0 ? 0 : Math.atan2(flatY, flatX);
      const sx = fx + proj * Math.cos(ang);
      const sy = fy + proj * Math.sin(ang);
      if (sx < -SCREEN_MARGIN || sx > vw + SCREEN_MARGIN) continue;
      if (sy < -SCREEN_MARGIN || sy > vh + SCREEN_MARGIN) continue;
      if (proj > maxDistC) maxDistC = proj;
      // Precompute the compressed transform (constant per layout). `react` gates
      // it by the reactive radius (1 near the hero → 0 past REACT_R), so far-rim
      // cells stay still during the wave. Within the zone: pull is strongest near
      // the centre (decays with distance), scale shrinks uniformly to WAVE_SCALE.
      const react = 1 - smoothstep(REACT_R - REACT_FADE, REACT_R, proj);
      const pull = proj < 1 ? 0 : PULL_MAX * Math.exp(-proj / PULL_DECAY) * react;
      const cx = proj < 1 ? 0 : ((fx - sx) / proj) * pull;
      const cy = proj < 1 ? 0 : ((fy - sy) / proj) * pull;
      const cs = 1 - (1 - WAVE_SCALE) * react;
      // Breath: radial OUTWARD drift, amplitude falling off with distance (the
      // rings hugging the hero breathe most; the rim sits still). 0 ⇒ no layer.
      const bf = proj < 1 ? 0 : 1 - smoothstep(hole, hole + BREATHE_SPAN, proj);
      const breathe = bf > BREATHE_MIN;
      const bx = breathe ? ((sx - fx) / proj) * BREATHE_MAX_PX * bf : 0;
      const by = breathe ? ((sy - fy) / proj) * BREATHE_MAX_PX * bf : 0;
      // Exit collapse: near cells drift toward a point just below the hero centre
      // + shrink (weighted, from the centre — gently). Far cells (cw→0) stay put.
      const cw = proj < 1 ? 1 : 1 - smoothstep(hole, hole + COLLAPSE_SPAN, proj);
      const collapsing = cw > 0.004;
      const tgtY = fy + vh * COLLAPSE_DROP_FRAC;
      const clx = collapsing ? (fx - sx) * cw * COLLAPSE_PULL : 0;
      const cly = collapsing ? (tgtY - sy) * cw * COLLAPSE_PULL : 0;
      const csc = collapsing ? 1 - cw * COLLAPSE_SHRINK : 1;
      spots.push({
        key: packKey(col, row),
        sx,
        sy,
        draw,
        drawH: draw * (VIEW_H / VIEW_W),
        distC: proj,
        cx,
        cy,
        cs,
        // Measured from the HOLE EDGE (like the entrance bloom), NOT the empty
        // centre — so the innermost cells react the instant the hero goes active
        // (no baked-in ~hole/WAVE_SPEED lead) and the sweep flows out from the ring.
        waveDelay: Math.max(0, (proj - hole) / WAVE_SPEED),
        bx,
        by,
        clx,
        cly,
        csc,
      });
    }
  }
  return { spots, vw, vh, fx, fy, hole, maxDistC };
};

// Distance of a spot from the hero ring's centre.
const ringDist = (s: Spot, f: Field) => Math.hypot(s.sx - f.fx, s.sy - f.fy);

// Would this spot's ring (its bounding box, plus a small gap) touch `r`?
const ringHitsRect = (s: Spot, r: Rect) => {
  const hw = s.draw / 2 + RESERVE_GAP;
  const hh = s.drawH / 2 + RESERVE_GAP;
  return s.sx + hw > r.x && s.sx - hw < r.x + r.w && s.sy + hh > r.y && s.sy - hh < r.y + r.h;
};

// Cells that are invisible anyway (inside the hero ring's clearing, in the
// white bottom band, or under the logo) → don't render (no wasted paint).
const renderSkip = (s: Spot, f: Field, reserve: Rect | null | undefined) => {
  if (ringDist(s, f) < f.hole) return true;
  if (s.sy > BOTTOM_WHITE * f.vh) return true;
  if (reserve && ringHitsRect(s, reserve)) return true;
  return false;
};

// Don't start a morph near the ring's edge, in the fading bottom, or on the logo.
const pickAvoid = (s: Spot, f: Field, reserve: Rect | null | undefined) => {
  if (ringDist(s, f) < f.hole + RING_GEOM.washSoft) return true;
  if (s.sy > BOTTOM_CALM * f.vh) return true;
  if (reserve && ringHitsRect(s, reserve)) return true;
  return false;
};

type IntroPhase = "pre" | "in" | "done";

// One cell, MEMOISED on its (all-primitive / stable-reference) props. This is the
// smoothness win: when one cell goes live / settles, only THAT cell re-renders —
// React no longer reconciles all ~150 cells on every morph start/finish, which was
// a periodic multi-ms task that dropped a frame ("edge of smooth" stutter). Cells
// are fully DECLARATIVE (no refs): entrance + reaction wave are driven by CSS
// classes + the per-cell custom properties below (--sgd/--cx/--cy/--wd).
type CellProps = {
  cls: string; // entrance phase class (shared; changes only during entrance)
  sx: number;
  sy: number;
  draw: number;
  drawH: number;
  cellKey: number;
  delay: number; // entrance bloom stagger (ms)
  cx: number; // inward-pull x offset (px) for the reaction wave
  cy: number; // inward-pull y offset (px)
  cs: number; // compressed scale (1 ⇒ this cell stays still during the wave)
  waveDelay: number; // reaction-wave stagger (ms)
  bx: number; // breath peak radial offset (px); 0 ⇒ this cell doesn't breathe
  by: number;
  breathDelay: number; // breath phase offset (ms) — flows outward from the hero
  clx: number; // exit-collapse drift x (px), cly y, csc target scale — applied on .sg-exit
  cly: number;
  csc: number;
  seg: number;
  pc: number;
  ringBase: readonly [string, string];
  seed: number; // current static seed
  seedB: number | undefined; // morph target while live
  onMorphDone: (key: number, seedB: number) => void;
};

const GridCell = memo(function GridCell({
  cls,
  sx,
  sy,
  draw,
  drawH,
  cellKey,
  delay,
  cx,
  cy,
  cs,
  waveDelay,
  bx,
  by,
  breathDelay,
  clx,
  cly,
  csc,
  seg,
  pc,
  ringBase,
  seed,
  seedB,
  onMorphDone,
}: CellProps) {
  // Exit collapse: the cell carries its collapsed-pose vars; the container's
  // `.sg-exit` class transitions the positioner to that pose (one-shot CSS
  // transition, ambient paused). Far cells (cls≈1, clx/cly≈0) don't move.
  // transform lives in CSS (.sg-pos) so the `.sg-exit` collapse rule can override
  // it — an inline transform would win over the stylesheet and block the collapse.
  const positioner = {
    position: "absolute",
    left: sx,
    top: sy,
    width: draw,
    height: drawH,
    "--clx": `${clx.toFixed(1)}px`,
    "--cly": `${cly.toFixed(1)}px`,
    "--cls": csc.toFixed(3),
  } as React.CSSProperties;
  const animStyle = {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    "--sgd": `${delay.toFixed(0)}ms`,
    "--cx": `${cx.toFixed(2)}px`,
    "--cy": `${cy.toFixed(2)}px`,
    "--cs": `${cs.toFixed(3)}`,
    "--wd": `${waveDelay.toFixed(0)}ms`,
  } as React.CSSProperties;
  const inner = (
    <div className={cls} style={animStyle}>
      {seedB !== undefined ? (
        <MorphRing
          seedA={seed}
          seedB={seedB}
          size={draw}
          segments={seg}
          pieces={pc}
          baseColors={ringBase}
          durationMs={MORPH_MS}
          onDone={() => onMorphDone(cellKey, seedB)}
        />
      ) : (
        <div
          style={{
            width: draw,
            height: drawH,
            backgroundImage: thumbUrl(seed, seg, pc, ringBase),
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "contain",
          }}
        />
      )}
    </div>
  );
  // Only NEAR cells breathe (bx/by ≠ 0): they get a wrapper that radial-drifts on
  // its own compositor layer. Far cells render `inner` directly — no wrapper, no
  // layer. The breath transform composes with the wave transform on `inner`.
  const breathing = bx !== 0 || by !== 0;
  return (
    <div className="sg-pos" style={positioner}>
      {breathing ? (
        <div
          className="sg-breath"
          style={
            {
              width: "100%",
              height: "100%",
              "--bx": `${bx.toFixed(2)}px`,
              "--by": `${by.toFixed(2)}px`,
              "--bd": `${breathDelay.toFixed(0)}ms`,
            } as React.CSSProperties
          }
        >
          {inner}
        </div>
      ) : (
        inner
      )}
    </div>
  );
});

type Props = {
  reserve?: Rect | null;
  intro?: boolean;
  theme?: StructureTheme;
  active?: boolean;
  /** true ⇒ play the scripted exit: the field collapses per-cell toward the centre
   *  hole (a one-shot CSS transition, `.sg-exit`). */
  exiting?: boolean;
  /** Fired ONCE after the first field's visible thumbnails have decoded — the
   *  scene gates its entrance on this so the spring is pure compositor work. */
  onReady?: () => void;
};

const StructureGridInner = forwardRef<StructureGridHandle, Props>(function StructureGrid(
  { reserve, intro = false, theme = LIGHT_THEME, active = true, exiting = false, onReady },
  ref,
) {
  const [field, setField] = useState<Field>(EMPTY_FIELD);
  // cell key → seedB while a cell is mid-morph.
  const [live, setLive] = useState<Map<number, number>>(new Map());
  // cell key → new static seed, once a morph has completed.
  const [overrides, setOverrides] = useState<Map<number, number>>(new Map());
  // Entrance phase: "pre" hidden, "in" springing, "done" steady (the reaction
  // wave's CSS animation plays in this phase).
  // `intro` opts in; rendered standalone (no orchestrator) it starts "done".
  const [introPhase, setIntroPhase] = useState<IntroPhase>(intro ? "pre" : "done");

  // Pool of static shapes (seeds) — thumbnails are built lazily per resolution.
  const [pool] = useState<number[]>(() => Array.from({ length: POOL }, () => randomSeed()));
  // Stable pool index per cell key (so a cell's static look never reshuffles).
  const cellPool = useRef<Map<number, number>>(new Map());
  // Fresh field/reserve for the morph picker (interval closes over stale state).
  const fieldRef = useRef<Field>(field);
  const reserveRef = useRef<Rect | null | undefined>(reserve);
  // The grid container — waveTo toggles ONE class here to drive the whole field's
  // reaction wave via CSS (cheap trigger; no per-cell JS, no per-cell refs).
  const containerRef = useRef<HTMLDivElement>(null);
  // onReady fires once, after the first field's visible thumbnails decode.
  const readyFiredRef = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    reserveRef.current = reserve;
  }, [reserve]);

  // Pause the per-cell breath while the hero is off-screen (compositor idle).
  // Toggled imperatively so it never clobbers the imperative `.sg-compress` class.
  useEffect(() => {
    containerRef.current?.classList.toggle("sg-still", !active);
  }, [active]);

  // Scripted exit: one class toggle transitions every cell to its collapsed pose
  // (compositor). Imperative ⇒ doesn't clobber `.sg-compress`/`.sg-still`.
  useEffect(() => {
    containerRef.current?.classList.toggle("sg-exit", exiting);
  }, [exiting]);

  // Read-only during render: the pool index for a key is assigned once, in the
  // measure effect below (keeping Math.random out of render). Returns the cell's
  // current static SEED; the thumbnail URL is derived from it + the cell's level.
  const cellSeed = (key: number): number => overrides.get(key) ?? pool[cellPool.current.get(key) ?? 0];

  // Stable callback so memoised cells never re-render just because the parent did.
  const onMorphDone = useCallback((key: number, seedB: number) => {
    // Settle to the new shape (thumbnail built lazily at this cell's resolution),
    // then drop the morph — touches only this cell's state.
    setOverrides((p) => new Map(p).set(key, seedB));
    setLive((p) => {
      const n = new Map(p);
      n.delete(key);
      return n;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      bloomIn() {
        setIntroPhase("in");
        const f = fieldRef.current;
        const maxDelay = Math.max(0, (f.maxDistC - f.hole) / SPRING_SPEED);
        window.setTimeout(() => setIntroPhase("done"), maxDelay + SPRING_MS + 80);
        return maxDelay + SPRING_MS; // total spring play time
      },
      reveal() {
        setIntroPhase("done");
      },
      waveTo(compressed: boolean) {
        // ONE class toggle drives the whole field: the CSS cascade applies the
        // compressed transform to every cell, each staggered by its own --wd, on
        // the compositor thread. No per-cell JS, so the trigger has no load spike.
        // (className prop is constant, so React never clobbers this imperative class.)
        containerRef.current?.classList.toggle("sg-compress", compressed);
        const f = fieldRef.current;
        // Total sweep time: the farthest cell's delay (measured from the hole
        // edge, matching waveDelay) + its own transition.
        return Math.max(0, f.maxDistC - f.hole) / WAVE_SPEED + WAVE_DUR;
      },
    }),
    [],
  );

  // Rebuild the projected field from the viewport on mount + resize.
  useEffect(() => {
    const measure = () => {
      const next = buildField(window.innerWidth, window.innerHeight);
      // Assign a stable pool index to any cell we haven't seen before (a cell's
      // static look never reshuffles, even across resizes).
      for (const s of next.spots) {
        if (!cellPool.current.has(s.key)) cellPool.current.set(s.key, (Math.random() * POOL) | 0);
      }
      fieldRef.current = next;
      setField(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Prewarm the raster cache for the visible cells' static thumbnails (current
  // theme) once the field is built — i.e. while the loader still covers the
  // scene — AND signal readiness when every one has decoded. Cells sit at
  // `scale(0)` until the entrance, so the browser otherwise defers each
  // thumbnail's first SVG decode until it gains area DURING the spring; ~150 of
  // them clustering near the wavefront is the first-reveal stutter. Decoding the
  // unique data-URLs here (same URLs the cells use ⇒ shared image cache) moves
  // that cost under the loader; `onReady` then lets the scene hold the loader
  // until it's done, leaving the spring pure compositor work. Cheap: the SVG
  // strings are already built+cached by render.
  useEffect(() => {
    if (field.spots.length === 0) return;
    const fireReady = () => {
      if (readyFiredRef.current) return;
      readyFiredRef.current = true;
      onReadyRef.current?.();
    };
    if (typeof Image === "undefined") {
      fireReady();
      return;
    }
    let cancelled = false;
    const run = () => {
      const seen = new Set<string>();
      const jobs: Promise<unknown>[] = [];
      for (const s of field.spots) {
        if (renderSkip(s, field, reserveRef.current)) continue;
        const res = resFor(s.draw);
        const seed = pool[cellPool.current.get(s.key) ?? 0];
        const css = thumbUrl(seed, res.seg, res.pc, theme.ringBase); // url("data:…")
        if (seen.has(css)) continue;
        seen.add(css);
        const img = new Image();
        img.decoding = "async";
        img.src = css.slice(5, -2); // strip the url(" … ") wrapper → raw data URI
        const p = img.decode?.();
        if (p) jobs.push(p.catch(() => {}));
      }
      // All visible thumbnails decoded ⇒ tell the scene it may play the entrance.
      Promise.all(jobs).then(() => {
        if (!cancelled) fireReady();
      });
    };
    // Kick off in idle time (bounded by the timeout) so the prewarm itself never
    // adds a long task on top of the loader's own paint.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 400 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [field, theme, pool]);

  const count = field.spots.length;

  // Periodically pick idle cells (in the field, away from ring/tagline/logo) to morph.
  // Skipped entirely while inactive (hero scrolled off-screen) ⇒ no new MorphRing
  // rAFs spin up where nobody can see them; resumes when the hero is back in view.
  useEffect(() => {
    // Gate on introPhase "done": no random cell morphs during the loader or the
    // entrance spring, so the enter stays pure (no MorphRing rAFs competing with
    // the bloom). They begin once the field has fully sprung in.
    if (count === 0 || !active || introPhase !== "done") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setLive((prev) => {
        if (prev.size >= MAX_LIVE) return prev;
        const f = fieldRef.current;
        if (f.spots.length === 0) return prev;
        const next = new Map(prev);
        let added = 0;
        for (let guard = 0; guard < 60 && added < BATCH && next.size < MAX_LIVE; guard++) {
          const s = f.spots[(Math.random() * f.spots.length) | 0];
          if (next.has(s.key)) continue; // GUARD: never re-pick a cell mid-morph
          if (pickAvoid(s, f, reserveRef.current)) continue;
          next.set(s.key, randomSeed()); // the shape it will morph TO
          added++;
        }
        return next;
      });
    }, ACTIVATE_MS);
    return () => clearInterval(id);
  }, [count, active, introPhase]);

  // Drop in-flight morphs whose cell vanished or fell into a cleared region (a
  // resize rebuilds the field). Otherwise their MorphRing unmounts without
  // firing onDone and the stuck entry permanently occupies the MAX_LIVE budget.
  useEffect(() => {
    setLive((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Map<number, Spot>(field.spots.map((s) => [s.key, s]));
      let changed = false;
      const next = new Map(prev);
      for (const k of next.keys()) {
        const s = alive.get(k);
        if (!s || renderSkip(s, field, reserve)) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [field, reserve]);

  const phaseClass = `sg-cell sg-${introPhase}`;

  return (
    <div
      ref={containerRef}
      className="sg-grid"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        // Isolated (contain); NOT a transform layer itself anymore — the breath is
        // per-cell now (see the breath effect / .sg-breath). Transparent: cleared
        // cells reveal the page's own background.
        contain: "layout style",
      }}
    >
      {/* Entrance + reaction wave are pure CSS (compositor-driven), so React
          re-renders (morphs settling) never restart them and the wave never
          touches the main thread per-frame. Entrance stagger rides --sgd. The
          reaction wave is ONE class on the container (.sg-compress): the cascade
          gives every cell its compressed transform (inward pull --cx/--cy +
          uniform scale), each staggered by --wd, then HELD until release. */}
      <style>{`
        .sg-cell{transform-origin:center center;}
        .sg-pre{transform:scale(0);opacity:0;transition:none;}
        .sg-in{transform:none;opacity:1;transition:transform ${SPRING_MS}ms ${SPRING_EASE},opacity ${SPRING_MS}ms ease-out;transition-delay:var(--sgd,0ms);}
        .sg-done{opacity:1;transform:none;transition:transform ${WAVE_DUR}ms ${WAVE_EASE_RELEASE} var(--wd,0ms);}
        .sg-compress .sg-done{transform:translate(var(--cx,0),var(--cy,0)) scale(var(--cs,1));transition-timing-function:${WAVE_EASE_COMPRESS};}
        .sg-breath{animation:sg-breath ${BREATHE_PERIOD_MS}ms ease-in-out infinite;animation-delay:var(--bd,0ms);}
        @keyframes sg-breath{0%,100%{transform:translate(0,0)}50%{transform:translate(var(--bx,0),var(--by,0))}}
        .sg-still .sg-breath{animation-play-state:paused;}
        .sg-pos{transform:translate(-50%,-50%);transition:transform ${EXIT_MS}ms ${EXIT_EASE} ${EXIT_DELAY_MS}ms;}
        .sg-exit .sg-pos{transform:translate(calc(-50% + var(--clx,0px)),calc(-50% + var(--cly,0px))) scale(var(--cls,1));}
        @media (prefers-reduced-motion:reduce){.sg-breath{animation:none;}.sg-pos{transition:none;}}
      `}</style>
      {field.spots.map((s) => {
        if (renderSkip(s, field, reserve)) return null;
        const res = resFor(s.draw); // smaller rim cells ⇒ fewer segments
        return (
          <GridCell
            key={s.key}
            cls={phaseClass}
            sx={s.sx}
            sy={s.sy}
            draw={s.draw}
            drawH={s.drawH}
            cellKey={s.key}
            delay={Math.max(0, (s.distC - field.hole) / SPRING_SPEED)}
            cx={s.cx}
            cy={s.cy}
            cs={s.cs}
            waveDelay={s.waveDelay}
            bx={s.bx}
            by={s.by}
            breathDelay={-(s.distC / (field.maxDistC || 1)) * BREATHE_WAVE_MS}
            clx={s.clx}
            cly={s.cly}
            csc={s.csc}
            seg={res.seg}
            pc={res.pc}
            ringBase={theme.ringBase}
            seed={cellSeed(s.key)}
            seedB={live.get(s.key)}
            onMorphDone={onMorphDone}
          />
        );
      })}
    </div>
  );
});

// Memoised so a parent (scene) re-render — e.g. the hero's idle self-morph — does
// NOT re-render the whole field; the grid only re-renders on its own state, and
// then only the changed cell (GridCell is memoised) actually reconciles.
const StructureGrid = memo(StructureGridInner);

export default StructureGrid;
