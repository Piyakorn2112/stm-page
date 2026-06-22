/**
 * flowEngine.ts — physics for the "Where it takes form" graphic, as a WATERFALL: many
 * small STM rings pour from the top, fall under gravity, and COLLIDE — with each other
 * (soft-body point collision, the same kind the icon emitter uses, so they naturally
 * jostle and push forward) and with the container WALLS (solid — they pile/settle, never
 * pushed out or clipped). Each ring also morphs circle → its twisted brand form and
 * tumbles. Bodies age out and recycle to the top, so the volume stays full but alive.
 *
 * The ring count is derived from the container area (fill a fixed fraction), capped so
 * it never gets dense enough to break the collision solver. The geometry/colour is drawn
 * by the renderer (@stm-ring); the engine owns the soft-body physics. Pure math, px.
 */

export const FLOW_MAX = 40; // hard pool cap (active count is computed from area ≤ this)
export const FLOW_K = 8; // points per soft-body ring (low-res collision hull)

// ── tunables (px, seconds) ───────────────────────────────────────────────────
const WALL = 8;
// Emitted from the TOP surface and carried down by a PUSH force (not runaway gravity):
// with drag it reaches a gentle terminal speed — the icon-emitter force model + inertia.
// Rings push each OTHER apart by soft collision; solid walls contain them; they fill
// from the bottom up.
const RISE = 620; // upward push (px/s²) — the rings flow UP from the bottom
const OUTV0 = 110; // upward emerge speed at the bottom surface (px/s)
const DRAG = 0.93;
const MAXV_FRAC = 0.5; // per-point speed cap ÷ radius (stability)
// shape-match stiffness ramps with the morph: SOFT while it's an untwisted circle
// (a squishy lava-lamp soft body that visibly deforms on collision) → STIFF once it
// has become the twisted STM ring (holds its precise form).
const MATCH_SOFT = 0.2;
const MATCH_STIFF = 0.58;
const ITER = 3;
const REPEL = 0.7; // soft point-collision push
const PR_FRAC = 0.5; // collision radius per point ÷ body radius
const FILL = 0.52; // target area fraction the rings occupy (volume fill)
const MIN_RINGS = 6;
const SPAWN_DT = 0.12; // s between emissions
// morph spring (circle → twist): UNDERDAMPED and SNAPPY so the form doesn't ooze into
// shape — it POPS, springing in fast with a playful overshoot, then settles.
const SPRING_OMEGA = 5.6;
const SPRING_ZETA = 0.5;
// scale PUNCH at the moment of the twist: a one-shot pop spring kicks the rendered radius
// up ~16% and rings back to 1, so the transform reads as a snap-into-shape, not a slow fade.
const POP_OMEGA = 13; // pop spring stiffness (fast)
const POP_ZETA = 0.28; // lightly damped → the scale springs UP then DIPS under and settles
const POP_KICK = 3.2; // velocity impulse on the pop scale when the twist fires
const SZ_MIN = 0.85; // slight per-ring size variation: this.r × [SZ_MIN, SZ_MIN+SZ_VAR]
const SZ_VAR = 0.32;
const BODY_SEP = 0.6; // strength of the body-level anti-clip separation
const TWIST_AT = 0.72; // yFrac the morph TARGET flips to 1 — twist LOWER in the canvas
const TWIST_JITTER = 0.12; // per-ring randomness in the twist height (± yFrac)
const REND_EXTENT = 1.15; // rendered ring reach ÷ radius (incl. half stroke) — for containment
const BIRTH_T = 0.4; // grow/fade in
const LIFE_MIN = 3; // age faster ⇒ quicker churn/recycle
const LIFE_MAX = 6;
const DEATH_T = 0.9; // shrink/fade out, then recycle

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// the K hull angles never change — precompute cos/sin once (used every shape-match iter)
const KCOS = Float64Array.from({ length: FLOW_K }, (_, k) => Math.cos((k / FLOW_K) * Math.PI * 2));
const KSIN = Float64Array.from({ length: FLOW_K }, (_, k) => Math.sin((k / FLOW_K) * Math.PI * 2));

export type FlowSnapshot = {
  cx: Float64Array;
  cy: Float64Array;
  rad: Float64Array;
  rot: Float64Array;
  morph: Float64Array;
  seed: Int32Array;
  op: Float64Array;
  hx: Float64Array; // FLOW_MAX·FLOW_K soft-body hull points, normalised to ~unit radius
  hy: Float64Array;
};

type Ring = {
  x: Float64Array; // K collision points
  y: Float64Array;
  ox: Float64Array;
  oy: Float64Array;
  alive: boolean;
  age: number;
  life: number;
  seed: number;
  morph: number;
  mvel: number;
  rot: number;
  rotV: number;
  scl: number;
  sz: number; // per-ring size factor (slight variation), ×this.r
  twistAt: number; // per-ring twist height (yFrac), jittered around TWIST_AT
  pop: number; // one-shot scale punch at the twist (render-only), springs back to 1
  popV: number;
  popped: boolean; // whether the pop kick has already fired this life
  op: number;
  pr: number; // current collision radius per point
};

export class FlowWorld {
  private rnd: () => number;
  private w = 420;
  private h = 700;
  private r = 28; // body radius (px)
  private activeN = 12; // alive target (from area)
  private rings: Ring[];
  private time = 0;
  private nextSpawn = 0;
  private ringSeed = 1;
  private snapCx = new Float64Array(FLOW_MAX);
  private snapCy = new Float64Array(FLOW_MAX);
  private snapRad = new Float64Array(FLOW_MAX);
  private snapRot = new Float64Array(FLOW_MAX);
  private snapMorph = new Float64Array(FLOW_MAX);
  private snapSeed = new Int32Array(FLOW_MAX);
  private snapOp = new Float64Array(FLOW_MAX);
  private snapHx = new Float64Array(FLOW_MAX * FLOW_K);
  private snapHy = new Float64Array(FLOW_MAX * FLOW_K);

  constructor(seed = 11) {
    this.rnd = mulberry32(seed);
    this.rings = Array.from({ length: FLOW_MAX }, () => ({
      x: new Float64Array(FLOW_K),
      y: new Float64Array(FLOW_K),
      ox: new Float64Array(FLOW_K),
      oy: new Float64Array(FLOW_K),
      alive: false,
      age: 0,
      life: 0,
      seed: 0,
      morph: 0,
      mvel: 0,
      rot: 0,
      rotV: 0,
      scl: 0,
      sz: 1,
      twistAt: TWIST_AT,
      pop: 1,
      popV: 0,
      popped: false,
      op: 0,
      pr: 14,
    }));
  }

  config(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.r = Math.max(18, Math.min(40, Math.min(this.w, this.h) * 0.06));
    // ring count to fill FILL of the area, capped so the solver never overloads
    const n = Math.round((this.w * this.h * FILL) / (Math.PI * this.r * this.r));
    this.activeN = Math.max(MIN_RINGS, Math.min(FLOW_MAX, n));
  }

  private spawn(g: Ring) {
    g.sz = SZ_MIN + this.rnd() * SZ_VAR;
    const r = this.r * g.sz;
    g.alive = true;
    g.age = 0;
    g.life = LIFE_MIN + this.rnd() * (LIFE_MAX - LIFE_MIN);
    g.seed = this.ringSeed++;
    g.morph = 0;
    g.mvel = 0;
    g.twistAt = TWIST_AT + (this.rnd() * 2 - 1) * TWIST_JITTER; // each ring twists at its own height
    g.pop = 1;
    g.popV = 0;
    g.popped = false;
    g.rot = this.rnd() * Math.PI * 2;
    g.rotV = (this.rnd() * 2 - 1) * 1.1; // tumble
    g.scl = 0.0001;
    g.op = 0;
    g.pr = r * PR_FRAC;
    // emerge from the BOTTOM surface (random across the width), bursting upward
    const cx = WALL + r + this.rnd() * Math.max(1, this.w - 2 * (WALL + r));
    const cy = this.h - WALL - r * 0.6;
    const vy = -OUTV0 / 60;
    for (let k = 0; k < FLOW_K; k++) {
      const a = (k / FLOW_K) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      g.x[k] = px;
      g.y[k] = py;
      g.ox[k] = px;
      g.oy[k] = py - vy;
    }
  }

  step(dt: number) {
    this.time += dt;
    // pour: keep ~activeN alive, fed from the top at a steady rate
    let aliveCount = 0;
    for (const g of this.rings) if (g.alive) aliveCount++;
    while (this.time >= this.nextSpawn && aliveCount < this.activeN) {
      this.nextSpawn += SPAWN_DT;
      const free = this.rings.find((q) => !q.alive);
      if (free) {
        this.spawn(free);
        aliveCount++;
      }
    }
    if (this.time > this.nextSpawn) this.nextSpawn = this.time; // don't bank backlog

    const { rings, w, h } = this;
    const h2 = dt * dt;
    const push = RISE * h2; // upward push per step
    const o = SPRING_OMEGA;
    const z = SPRING_ZETA;

    for (const g of rings) {
      if (!g.alive) {
        g.op = 0;
        continue;
      }
      g.age += dt;
      // birth grow-in, life, death shrink-out → recycle
      let scl = Math.min(1, g.age / BIRTH_T);
      let op = scl;
      const dd = g.age - g.life;
      if (dd > 0) {
        const k = dd / DEATH_T;
        if (k >= 1) {
          g.alive = false;
          g.op = 0;
          continue;
        }
        scl = 1 - k * 0.85;
        op = 1 - k;
      }
      g.scl = scl;
      g.op = op;
      g.rot += g.rotV * dt;
      // morph spring toward the twist — but the TARGET stays a circle until the ring
      // has fallen a little PAST a-bit-before-mid-height, so it only starts transforming
      // around the middle of its journey (not at the top).
      let cyc = 0;
      for (let k = 0; k < FLOW_K; k++) cyc += g.y[k];
      const yf = cyc / FLOW_K / h;
      const mt = yf <= g.twistAt ? 1 : 0;
      const macc = o * o * (mt - g.morph) - 2 * z * o * g.mvel;
      g.mvel += macc * dt;
      g.morph += g.mvel * dt;
      // scale PUNCH: the first frame the twist target fires, kick the pop spring so the
      // ring snaps up in size and rings back — the transform reads as a pop, not a fade.
      if (mt === 1 && !g.popped) {
        g.popV += POP_KICK;
        g.popped = true;
      }
      const pacc = POP_OMEGA * POP_OMEGA * (1 - g.pop) - 2 * POP_ZETA * POP_OMEGA * g.popV;
      g.popV += pacc * dt;
      g.pop += g.popV * dt;
      // settle: once the playful spring has rung down at the twist, pin morph exactly to
      // 1 so the renderer locks to the cached final geometry (the overshoot is a one-shot)
      if (mt === 1 && Math.abs(g.morph - 1) < 0.01 && Math.abs(g.mvel) < 0.04) {
        g.morph = 1;
        g.mvel = 0;
      }
      const sr = this.r * g.sz * scl;
      g.pr = sr * PR_FRAC;

      // integrate (verlet) + downward push, with a per-point speed cap
      const maxv = sr * MAXV_FRAC;
      const maxv2 = maxv * maxv;
      for (let k = 0; k < FLOW_K; k++) {
        let vx = (g.x[k] - g.ox[k]) * DRAG;
        let vy = (g.y[k] - g.oy[k]) * DRAG;
        const v2 = vx * vx + vy * vy;
        if (v2 > maxv2) {
          const s = maxv / Math.sqrt(v2);
          vx *= s;
          vy *= s;
        }
        g.ox[k] = g.x[k];
        g.oy[k] = g.y[k];
        g.x[k] += vx;
        g.y[k] += vy - push;
      }
      // shape-match toward a circle of radius sr — soft (squishy) while untwisted,
      // firming up as it morphs into the twisted ring
      const match = MATCH_SOFT + (MATCH_STIFF - MATCH_SOFT) * Math.min(1, Math.max(0, g.morph));
      for (let it = 0; it < ITER; it++) {
        let mx = 0;
        let my = 0;
        for (let k = 0; k < FLOW_K; k++) {
          mx += g.x[k];
          my += g.y[k];
        }
        mx /= FLOW_K;
        my /= FLOW_K;
        for (let k = 0; k < FLOW_K; k++) {
          const gx = mx + KCOS[k] * sr;
          const gy = my + KSIN[k] * sr;
          g.x[k] += (gx - g.x[k]) * match;
          g.y[k] += (gy - g.y[k]) * match;
        }
      }
      // solid container walls — clamp the CENTROID with a margin for the whole RENDERED
      // ring (radius + half stroke), not just the collision hull, so it never clips.
      const rEff = sr * REND_EXTENT;
      let mcx = 0;
      let mcy = 0;
      for (let k = 0; k < FLOW_K; k++) {
        mcx += g.x[k];
        mcy += g.y[k];
      }
      mcx /= FLOW_K;
      mcy /= FLOW_K;
      const xlo = WALL + rEff;
      const xhi = w - WALL - rEff;
      const ylo = WALL + rEff;
      const yhi = h - WALL - rEff;
      const cmx = xhi >= xlo ? Math.min(xhi, Math.max(xlo, mcx)) : w / 2;
      const cmy = yhi >= ylo ? Math.min(yhi, Math.max(ylo, mcy)) : h / 2;
      const ddx = cmx - mcx;
      const ddy = cmy - mcy;
      if (ddx !== 0 || ddy !== 0) {
        for (let k = 0; k < FLOW_K; k++) {
          g.x[k] += ddx;
          g.y[k] += ddy;
        }
      }
    }

    // soft ring ↔ ring collision (point vs point, broad-phase by centroid AABB)
    for (let i = 0; i < rings.length; i++) {
      const A = rings[i];
      if (!A.alive) continue;
      let acx = 0;
      let acy = 0;
      for (let k = 0; k < FLOW_K; k++) {
        acx += A.x[k];
        acy += A.y[k];
      }
      acx /= FLOW_K;
      acy /= FLOW_K;
      for (let j = i + 1; j < rings.length; j++) {
        const B = rings[j];
        if (!B.alive) continue;
        let bcx = 0;
        let bcy = 0;
        for (let k = 0; k < FLOW_K; k++) {
          bcx += B.x[k];
          bcy += B.y[k];
        }
        bcx /= FLOW_K;
        bcy /= FLOW_K;
        const reach = this.r * 2.4; // generous broad-phase radius (covers the largest pair)
        if (Math.abs(acx - bcx) > reach || Math.abs(acy - bcy) > reach) continue;
        const md = A.pr + B.pr;
        const md2 = md * md;
        for (let a = 0; a < FLOW_K; a++) {
          for (let b = 0; b < FLOW_K; b++) {
            const dx = A.x[a] - B.x[b];
            const dy = A.y[a] - B.y[b];
            const d2 = dx * dx + dy * dy;
            if (d2 >= md2 || d2 < 1e-9) continue;
            const d = Math.sqrt(d2);
            const ov = (md - d) * 0.5 * REPEL;
            const nx = dx / d;
            const ny = dy / d;
            A.x[a] += nx * ov;
            A.y[a] += ny * ov;
            B.x[b] -= nx * ov;
            B.y[b] -= ny * ov;
          }
        }
        // body-level anti-CLIP: if the hulls have interpenetrated (one ring's centre
        // shoved deep inside the other — the point pass alone doesn't always resolve a
        // small ring sitting inside a big one), push the WHOLE bodies apart along the
        // centre line so their outlines can't cross.
        const minSep = ((A.pr + B.pr) / PR_FRAC) * 0.7; // ≈ 0.7·(rA + rB)
        let cdx = acx - bcx;
        let cdy = acy - bcy;
        const cd = Math.hypot(cdx, cdy) || 0.001;
        if (cd < minSep) {
          const pushB = (minSep - cd) * 0.5 * BODY_SEP;
          cdx /= cd;
          cdy /= cd;
          for (let k = 0; k < FLOW_K; k++) {
            A.x[k] += cdx * pushB;
            A.y[k] += cdy * pushB;
            B.x[k] -= cdx * pushB;
            B.y[k] -= cdy * pushB;
          }
          acx += cdx * pushB; // keep A's centroid current for the next j
          acy += cdy * pushB;
        }
      }
    }
  }

  /** reduced-motion: a still settled heap. */
  warm() {
    const r = this.r;
    const cols = Math.max(1, Math.floor((this.w - 2 * WALL) / (2 * r)));
    let i = 0;
    for (const g of this.rings) {
      if (i >= this.activeN) {
        g.alive = false;
        g.op = 0;
        continue;
      }
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = WALL + r + col * 2 * r;
      const cy = this.h - WALL - r - row * 2 * r;
      g.alive = true;
      g.age = 1;
      g.life = 1e9;
      g.seed = i + 5;
      g.morph = 1;
      g.mvel = 0;
      g.rot = (i % 7) * 0.5;
      g.rotV = 0;
      g.scl = 1;
      g.op = 1;
      g.pr = r * PR_FRAC;
      for (let k = 0; k < FLOW_K; k++) {
        const a = (k / FLOW_K) * Math.PI * 2;
        g.x[k] = cx + Math.cos(a) * r;
        g.y[k] = cy + Math.sin(a) * r;
        g.ox[k] = g.x[k];
        g.oy[k] = g.y[k];
      }
      i++;
    }
  }

  snapshot(): FlowSnapshot {
    for (let i = 0; i < FLOW_MAX; i++) {
      const g = this.rings[i];
      let cx = 0;
      let cy = 0;
      for (let k = 0; k < FLOW_K; k++) {
        cx += g.x[k];
        cy += g.y[k];
      }
      cx /= FLOW_K;
      cy /= FLOW_K;
      // pop is render-only: it scales the drawn radius (snap-into-shape) without touching
      // the physics radius/collision, so neighbours don't get shoved by the punch.
      const rad = this.r * g.sz * (g.alive ? Math.max(0, g.scl) * g.pop : 0);
      this.snapCx[i] = cx;
      this.snapCy[i] = cy;
      this.snapRad[i] = rad;
      this.snapRot[i] = g.rot;
      this.snapMorph[i] = g.morph;
      this.snapSeed[i] = g.seed;
      this.snapOp[i] = g.alive ? g.op : 0;
      // normalised soft-body hull (≈ unit radius) so the renderer can deform the ring
      const base = Math.max(rad, 1);
      for (let k = 0; k < FLOW_K; k++) {
        this.snapHx[i * FLOW_K + k] = (g.x[k] - cx) / base;
        this.snapHy[i * FLOW_K + k] = (g.y[k] - cy) / base;
      }
    }
    return {
      cx: this.snapCx,
      cy: this.snapCy,
      rad: this.snapRad,
      rot: this.snapRot,
      morph: this.snapMorph,
      seed: this.snapSeed,
      op: this.snapOp,
      hx: this.snapHx,
      hy: this.snapHy,
    };
  }
}
