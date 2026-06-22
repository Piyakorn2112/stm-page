/**
 * softBody.ts — a 2D LAVA-LAMP soft-body engine for the brand graphic. Four closed
 * wire "blobs" (orange = creativity, blue = engineering, purple = intelligence, plus
 * a smaller ink "identity" blob) live in a square invisible container under downward
 * gravity, so they settle and squish at the bottom. One blob at a time is randomly
 * "heated" (non-repeating): its heat eases up, buoyancy lifts it, and it FLOATS to
 * the top, squishing past the others — then it COOLS and slowly SINKS back down while
 * the next blob is selected. Smooth, hypnotic, ever-changing. Symbolism: the system's
 * parts taking turns to rise, lead, and settle.
 *
 * METHOD — Position-Based Dynamics (PBD; Müller et al. 2007): Verlet integration +
 * constraints PROJECTED a few times per frame (smooth, no penalty-force jitter):
 * per-edge DISTANCE constraints (surface-tension skin), one AREA-preservation
 * constraint kept slightly over target (`overpressure` ⇒ taut bubble), a light
 * Laplacian SMOOTH, positional COLLISION between blobs (a SKIN gap so they squish but
 * never merge) and against the square WALLS. Buoyancy/gravity are the only external
 * accelerations; the heat state machine decides who rises.
 *
 * Simulated in a fixed SIZE×SIZE virtual square; the renderer scales it, so resizing
 * never perturbs the physics. Pure math — no DOM, no React, no dependency on the core.
 *
 * ════════════════════════════════════════════════════════════════════════════
 *  ALL TUNABLE KNOBS LIVE AT THE TOP — a GLOBAL block and the per-blob `RINGS` array.
 * ════════════════════════════════════════════════════════════════════════════
 */

export const SIZE = 200; // virtual world is SIZE×SIZE units

// ─────────────────────────── GLOBAL KNOBS ───────────────────────────────────
const N = 44; // particles per blob. More = smoother contour & cleaner contacts, heavier.
const ITER = 10; // constraint solver iterations / step. More = stiffer & smoother, heavier.
const DRAG = 0.99; // velocity retention 0..1 each step. High = viscous, slow lava drift.
const SMOOTH = 0.085; // per-iteration Laplacian smoothing (acts like surface tension).
const BREATHE_W = 0.6; // base breathing rate (rad/s); per-blob amplitude is in RINGS.

// CONTAINER — a square invisible box the blobs live in. WALL is the inset from the
// world edge; smaller = the blobs fill more of the frame.
const WALL = 7;

// LAVA-LAMP DYNAMICS.
const GRAV_DOWN = 135; // downward gravity (units/s²) — blobs sink & settle at the bottom.
const BUOY = 390; // upward buoyancy when a blob is fully heated (must beat gravity AND
// push up through the blobs above it, so the heated one truly rises to the top).
const HEAT_RATE = 1.1; // how fast heat eases in/out (per second) — smooth heat-up / cool-down.
const MAX_HEAT_SEC = 8; // safety: force-select the next blob after this long if it never tops.
const TOP_FRAC = 0.3; // a blob counts as "reached the top" when its centroid rises above this
// fraction of the box height (then it cools & a new blob is heated).
const WOBBLE = 9; // gentle horizontal drift (units/s²) so blobs don't rise in straight columns.
const WALL_FRICTION = 0.36; // tangential friction where a blob touches the container wall ⇒
// it grips and stops sliding around the bottom instead of drifting forever.
const WALL_CONTACT = 2.6; // units from the wall counted as "touching" (friction band).

// CONTACT — gap held between two blobs' contours (units): squish & deform, never merge.
const WIRE_REF_R = 27; // reference radius the wire gauge is based on
export const WIRE = 0.148 * 2 * WIRE_REF_R; // ≈8.6 units — matches the STM ring's stroke:size
const SKIN = WIRE * 1.06;

// SOLVER SAFETY.
const VMAX = 3.0; // max per-step particle displacement (units) — anti-explosion clamp.
const SUBSTEPS = 2; // integration substeps per frame.
const MAX_FRAME = 1 / 30; // clamp frame dt (tab refocus) so nothing tunnels.

const TOP_Y = WALL + (SIZE - 2 * WALL) * TOP_FRAC; // y above which = "at the top"

// ───────────────────────────── PER-BLOB KNOBS ───────────────────────────────
// One entry per blob. Each is an independent bubble with its own size & feel.
//   color        : key the renderer maps to a CSS brand var (orange/blue/purple/ink).
//   radius       : rest radius = SIZE. Wire thickness is the SAME for all (global WIRE).
//   pressure     : AREA-keep stiffness 0..1 = volume firmness. Higher = rounder/firmer.
//   overpressure : target-area multiplier. >1 = taut, over-inflated bubble.
//   stretch      : edge (distance) stiffness 0..1 = skin elasticity. 1 = inextensible.
//   buoyancy     : how strongly THIS blob rises when heated (× global BUOY). >1 pops up
//                  livelier, <1 is a reluctant/heavy blob.
//   breatheAmp   : gentle target-area pulse (alive at rest).
type RingCfg = {
  color: string;
  radius: number;
  pressure: number;
  overpressure: number;
  stretch: number;
  buoyancy: number;
  breatheAmp: number;
};

// A spread of DIFFERENT-SIZED bubbles in the three brand colours (creativity =
// orange, engineering = blue, intelligence = purple); smaller blobs are a touch
// more buoyant so they bob up eagerly. Add/remove entries freely.
const RINGS: RingCfg[] = [
  { color: "orange", radius: 30, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 0.98, breatheAmp: 0.05 },
  { color: "blue", radius: 26, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 1.05, breatheAmp: 0.05 },
  { color: "purple", radius: 22, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 1.12, breatheAmp: 0.05 },
  { color: "orange", radius: 18, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 1.24, breatheAmp: 0.05 },
  { color: "blue", radius: 28, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 1.0, breatheAmp: 0.05 },
  { color: "purple", radius: 20, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 1.18, breatheAmp: 0.05 },
  // a small black "ink" blob for visual tension against the brand colours
  { color: "ink", radius: 16, pressure: 0.85, overpressure: 1.05, stretch: 1, buoyancy: 1.3, breatheAmp: 0.05 },
];

// Deterministic PRNG so the composition (and the static frame) is reproducible.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type SoftRingState = { color: string; xs: Float64Array; ys: Float64Array; n: number };

class SoftRing {
  n = N;
  px = new Float64Array(N);
  py = new Float64Array(N);
  ox = new Float64Array(N); // previous positions (Verlet)
  oy = new Float64Array(N);
  tx = new Float64Array(N); // scratch (smoothing)
  ty = new Float64Array(N);
  cfg: RingCfg;
  restLen: number;
  restArea: number; // signed (matches winding)
  phase: number; // breathing + wobble phase
  bw: number; // breathing rate
  heat = 0; // 0 = cool (sinks), 1 = hot (rises)
  heatTarget = 0;
  // broad-phase scratch (centroid + AABB), recomputed each constraint iteration
  cx = 0;
  cy = 0;
  minx = 0;
  maxx = 0;
  miny = 0;
  maxy = 0;

  constructor(cfg: RingCfg, cx: number, cy: number, idx: number, rnd: () => number) {
    this.cfg = cfg;
    this.phase = idx * 1.7;
    this.bw = BREATHE_W * (0.82 + 0.16 * idx);
    const r0 = cfg.radius;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = r0 * (0.98 + rnd() * 0.04);
      this.px[i] = cx + Math.cos(a) * r;
      this.py[i] = cy + Math.sin(a) * r;
      this.ox[i] = this.px[i];
      this.oy[i] = this.py[i];
    }
    this.restLen = 2 * r0 * Math.sin(Math.PI / N);
    this.restArea = this.signedArea();
  }

  signedArea(): number {
    let a = 0;
    for (let i = 0, j = this.n - 1; i < this.n; j = i++) {
      a += this.px[j] * this.py[i] - this.px[i] * this.py[j];
    }
    return a * 0.5;
  }

  centroidY(): number {
    let cy = 0;
    for (let i = 0; i < this.n; i++) cy += this.py[i];
    return cy / this.n;
  }

  // Centroid + axis-aligned bounding box, for broad-phase collision culling.
  bounds() {
    const { px, py, n } = this;
    let cx = 0;
    let cy = 0;
    let mnx = Infinity;
    let mxx = -Infinity;
    let mny = Infinity;
    let mxy = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = px[i];
      const y = py[i];
      cx += x;
      cy += y;
      if (x < mnx) mnx = x;
      if (x > mxx) mxx = x;
      if (y < mny) mny = y;
      if (y > mxy) mxy = y;
    }
    this.cx = cx / n;
    this.cy = cy / n;
    this.minx = mnx;
    this.maxx = mxx;
    this.miny = mny;
    this.maxy = mxy;
  }

  solveDistance() {
    const { px, py, n, restLen } = this;
    const k = this.cfg.stretch;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      let dx = px[j] - px[i];
      let dy = py[j] - py[i];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const corr = ((d - restLen) / d) * 0.5 * k;
      dx *= corr;
      dy *= corr;
      px[i] += dx;
      py[i] += dy;
      px[j] -= dx;
      py[j] -= dy;
    }
  }

  solveArea(target: number) {
    const { px, py, n } = this;
    const A = this.signedArea();
    let sum2 = 0;
    for (let i = 0; i < n; i++) {
      const ip = (i + 1) % n;
      const im = (i - 1 + n) % n;
      const gx = 0.5 * (py[ip] - py[im]);
      const gy = 0.5 * (px[im] - px[ip]);
      sum2 += gx * gx + gy * gy;
    }
    if (sum2 < 1e-9) return;
    const lambda = ((A - target) / sum2) * this.cfg.pressure;
    for (let i = 0; i < n; i++) {
      const ip = (i + 1) % n;
      const im = (i - 1 + n) % n;
      const gx = 0.5 * (py[ip] - py[im]);
      const gy = 0.5 * (px[im] - px[ip]);
      px[i] -= lambda * gx;
      py[i] -= lambda * gy;
    }
  }

  smooth() {
    const { px, py, tx, ty, n } = this;
    for (let i = 0; i < n; i++) {
      const ip = (i - 1 + n) % n;
      const iq = (i + 1) % n;
      tx[i] = px[i] + SMOOTH * (0.5 * (px[ip] + px[iq]) - px[i]);
      ty[i] = py[i] + SMOOTH * (0.5 * (py[ip] + py[iq]) - py[i]);
    }
    px.set(tx);
    py.set(ty);
  }

  // Keep every particle inside the square container.
  walls() {
    const { px, py, n } = this;
    const lo = WALL;
    const hi = SIZE - WALL;
    for (let i = 0; i < n; i++) {
      if (px[i] < lo) px[i] = lo;
      else if (px[i] > hi) px[i] = hi;
      if (py[i] < lo) py[i] = lo;
      else if (py[i] > hi) py[i] = hi;
    }
  }
}

export class SoftBodyWorld {
  rings: SoftRing[];
  time = 0;
  private rnd: () => number;
  private selected = -1; // index of the currently-heated blob
  private selStart = 0; // when it was selected (sim seconds)

  constructor(seed = 7) {
    this.rnd = mulberry32(seed);
    const rnd = this.rnd;
    const len = RINGS.length;
    const span = SIZE - 2 * WALL;
    this.rings = RINGS.map((cfg, i) => {
      // spread across the width, dropped from the upper area so they fall & settle
      const cx = WALL + ((i + 0.5) / len) * span + (rnd() - 0.5) * 14;
      const cy = WALL + span * (0.2 + rnd() * 0.32);
      return new SoftRing(cfg, cx, cy, i, rnd);
    });
  }

  private pickNext(): number {
    const len = this.rings.length;
    if (len <= 1) return 0;
    let n = this.selected;
    while (n === this.selected) n = (this.rnd() * len) | 0; // non-repeat
    return n;
  }

  // Assumes B.bounds() has been computed this iteration.
  private collide(A: SoftRing, B: SoftRing) {
    const bcx = B.cx;
    const bcy = B.cy;
    // B's AABB grown by SKIN: a point outside it CANNOT be within SKIN of B's
    // surface, so we skip the per-edge search for it (exact, no behaviour change).
    const lo_x = B.minx - SKIN;
    const hi_x = B.maxx + SKIN;
    const lo_y = B.miny - SKIN;
    const hi_y = B.maxy + SKIN;
    for (let i = 0; i < A.n; i++) {
      const px = A.px[i];
      const py = A.py[i];
      if (px < lo_x || px > hi_x || py < lo_y || py > hi_y) continue;
      let best = Infinity;
      let qx = 0;
      let qy = 0;
      let ei = 0;
      let et = 0;
      for (let j = 0; j < B.n; j++) {
        const k = (j + 1) % B.n;
        const ax = B.px[j];
        const ay = B.py[j];
        const ex = B.px[k] - ax;
        const ey = B.py[k] - ay;
        const el2 = ex * ex + ey * ey || 1e-9;
        let t = ((px - ax) * ex + (py - ay) * ey) / el2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cxp = ax + ex * t;
        const cyp = ay + ey * t;
        const dx = px - cxp;
        const dy = py - cyp;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          qx = cxp;
          qy = cyp;
          ei = j;
          et = t;
        }
      }
      let nx = qx - bcx;
      let ny = qy - bcy;
      const nl = Math.sqrt(nx * nx + ny * ny) || 1e-9;
      nx /= nl;
      ny /= nl;
      const signed = (px - qx) * nx + (py - qy) * ny;
      const pen = SKIN - signed;
      if (pen <= 0) continue;
      A.px[i] += nx * pen * 0.5;
      A.py[i] += ny * pen * 0.5;
      const k = (ei + 1) % B.n;
      B.px[ei] -= nx * pen * (1 - et) * 0.5;
      B.py[ei] -= ny * pen * (1 - et) * 0.5;
      B.px[k] -= nx * pen * et * 0.5;
      B.py[k] -= ny * pen * et * 0.5;
    }
  }

  private substep(h: number) {
    const rings = this.rings;
    // 1) Verlet integration: gravity DOWN − buoyancy (heat) UP + a little wobble.
    for (const R of rings) {
      // ease heat toward its target (smooth heat-up / cool-down)
      R.heat += (R.heatTarget - R.heat) * Math.min(1, HEAT_RATE * h);
      const { px, py, ox, oy, n } = R;
      const ay0 = GRAV_DOWN - R.heat * BUOY * R.cfg.buoyancy; // +down, −up
      const ax0 = WOBBLE * Math.sin(this.time * 0.8 + R.phase);
      for (let i = 0; i < n; i++) {
        let vx = (px[i] - ox[i]) * DRAG;
        let vy = (py[i] - oy[i]) * DRAG;
        const sp = Math.sqrt(vx * vx + vy * vy);
        if (sp > VMAX) {
          const s = VMAX / sp;
          vx *= s;
          vy *= s;
        }
        ox[i] = px[i];
        oy[i] = py[i];
        px[i] += vx + ax0 * h * h;
        py[i] += vy + ay0 * h * h;
      }
    }
    // 2) Constraint solve (collisions + walls FIRST, then distance/area LAST so each
    //    iteration ends by re-smoothing the contour — no surviving contact kinks).
    for (let it = 0; it < ITER; it++) {
      for (const R of rings) R.bounds(); // refresh centroids + AABBs for culling
      for (let a = 0; a < rings.length; a++) {
        const A = rings[a];
        for (let b = a + 1; b < rings.length; b++) {
          const B = rings[b];
          // broad-phase: skip the whole pair when their SKIN-expanded AABBs are apart
          if (A.maxx + SKIN < B.minx || B.maxx + SKIN < A.minx || A.maxy + SKIN < B.miny || B.maxy + SKIN < A.miny)
            continue;
          this.collide(A, B);
          this.collide(B, A);
        }
      }
      for (const R of rings) {
        R.walls();
        R.smooth();
        const breathe = 1 + R.cfg.breatheAmp * Math.sin(this.time * R.bw + R.phase);
        R.solveDistance();
        R.solveArea(R.restArea * R.cfg.overpressure * breathe);
      }
    }
    // Wall friction (once per substep): a particle touching the container loses its
    // tangential speed (adjust the Verlet history) so blobs grip the bottom and stop
    // sliding around the curve instead of drifting forever.
    for (const R of rings) {
      const { px, py, ox, oy, n } = R;
      const lo = WALL + WALL_CONTACT;
      const hi = SIZE - WALL - WALL_CONTACT;
      for (let i = 0; i < n; i++) {
        let vx = px[i] - ox[i];
        let vy = py[i] - oy[i];
        let changed = false;
        if (py[i] > hi || py[i] < lo) {
          vx *= 1 - WALL_FRICTION; // touching bottom/top ⇒ damp the horizontal slide
          changed = true;
        }
        if (px[i] > hi || px[i] < lo) {
          vy *= 1 - WALL_FRICTION; // touching a side ⇒ damp the vertical slide
          changed = true;
        }
        if (changed) {
          ox[i] = px[i] - vx;
          oy[i] = py[i] - vy;
        }
      }
    }
  }

  step(frameDt: number) {
    const dt = Math.min(frameDt, MAX_FRAME);
    // Heat state machine: select a blob to heat; switch when it tops out or times out.
    if (this.selected < 0) {
      this.selected = (this.rnd() * this.rings.length) | 0;
      this.selStart = this.time;
    }
    const sel = this.rings[this.selected];
    if (sel.centroidY() < TOP_Y || this.time - this.selStart > MAX_HEAT_SEC) {
      this.selected = this.pickNext();
      this.selStart = this.time;
    }
    for (let i = 0; i < this.rings.length; i++) this.rings[i].heatTarget = i === this.selected ? 1 : 0;

    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      this.substep(h);
      this.time += h;
    }
  }

  /** Settle into a composed pose for the first (static) frame. */
  warm(seconds = 2.2) {
    const steps = Math.round(seconds * 60);
    for (let s = 0; s < steps; s++) this.step(1 / 60);
  }

  snapshot(): SoftRingState[] {
    return this.rings.map((r) => ({ color: r.cfg.color, xs: r.px, ys: r.py, n: r.n }));
  }
}
