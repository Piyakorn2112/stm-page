/**
 * arcEngine.ts — physics for the Philosophy graphic. A stiff black soft-body RING
 * sits in the open part of the section and gently breathes; icon "bubbles" continuously
 * EMERGE from it, grow as they push out, drift in a bounded cloud, then AGE — shrinking
 * until gone — and the slot is re-emitted. A never-resting, living loop.
 *
 * It works in REAL pixel coordinates configured by the section size + the text's
 * rectangle, so it fills the whole section and re-configures LIVE on resize (the sim
 * is shifted, never reset). The outward push is full within a bounded "cloud" radius
 * then decays exponentially, so icons settle in a cloud rather than flying to the edges,
 * and they're kept out of the text's reserve rectangle. Pure math — runs in a Worker.
 */

export const ARC_RC = 84; // central ring radius (px, medium)
export const ARC_WIRE = ARC_RC * 0.3; // ring wire gauge — matches the bubble rings' ratio
export const ICON_R = 32; // icon hitbox radius (px) — a touch larger
export const ARC_N = 80; // icon slots (pool size = desktop max active)
// ── KNOB: how many icons stay alive on a MOBILE-width section (fewer ⇒ lighter +
// less crowded on small screens). Applied below ~760px section width.
export const ARC_N_MOBILE = 60;
const MOBILE_W = 760; // section width under which the mobile cap applies
// ── KNOB: a third, lower cap for REALLY SMALL phone widths (Pixel 4 ~393, iPhone 12
// Pro ~390, XR ~414). The mobile cap (60) still crowds the ring at this width, so drop
// further. Applied below ~460px section width (= viewport width on these phones).
export const ARC_N_SMALL = 42;
const SMALL_W = 460; // section width under which the small-phone cap applies
const RING_SCALE_SMALL = 0.86; // central ring a touch smaller on really small phones

// ── tunables ─────────────────────────────────────────────────────────────────
const C = 34; // central-ring points
const K = 6; // points per icon soft body (low res, invisible hitbox)
const ITER = 10;
const ITER_ICON = 4;
const RING_DAMP = 0.9;
const K_AREA_C = 0.9; // ring pressure (softer ⇒ deforms more)
const SMOOTH_C = 0.12;
const BREATHE_AMP = 0.08;
const BREATHE_W = 1.16;
const RDEF_SOFT = 0.36; // one-way ring deformation as icons press
const RP = 0.62;
const PR = 0.5;
// ── INVISIBLE HITBOX SIZE (× ICON_R) — three independent stages ──────────────
//   HITBOX_EMERGE = hitbox size the moment it comes OUT of the ring (birth).
//   HITBOX_INIT   = hitbox size once FULLY GROWN (mid-life) — bigger ⇒ deforms ring more.
//   HITBOX_FINAL  = hitbox size it shrinks to as it dies (0 = vanishes completely).
const HITBOX_EMERGE = 0.1;
const HITBOX_INIT = 1.0;
const HITBOX_FINAL = 0.0;
const DRAG_ICON = 0.965;
const K_AREA_ICON = 0.45;
const ICON_REPEL = 0.5;
// ── OUTWARD PUSH — full within the cloud, exponential decay beyond ────────────
const OUTPUSH = 400; // outward acceleration near the ring (px/s²) — just clears it
const OUTV0 = 160; // base emerge burst speed (px/s)
// per-icon randomness ⇒ each has its own inertia & lands at a different distance:
const BURST_MIN = 0.8; // initial-burst random factor range …
const BURST_MAX = 1.6;
const MASS_MIN = 0.5; // mass range (heavier ⇒ more inertia ⇒ pushed less ⇒ lands closer)
const MASS_MAX = 1.4;
const R_FULL_PAD = 1.25; // packing factor (for warm()'s static cloud radius)
const R_FULL_CAP = 0.47;
const PUSH_DECAY = 12; // px e-folding of the push outward — short ⇒ icons settle near the ring
const SPAWN_INTERVAL = 0.8; // s between emissions
// FIRST-TIME INTRO: the ring breathes BIG, then as it settles back down it POURS
// icons out in every direction (a flowing release) — with NO ring deformation during
// it — then returns to the normal animation. Keyed on the world's OWN elapsed time, so
// scrolling away/back (which only pauses the worker) never re-triggers it.
const INTRO_INFLATE_T = 0; // s for the ring to breathe bigger
const INTRO_DEFLATE_T = 1.9; // s to settle back while pouring icons out
const INTRO_INFLATE_R = 1.22; // how much bigger it breathes (× radius)
// emission speed-up during the opening pour — separate per layout (knobs):
const INTRO_POUR_RATE = 30; // desktop
const INTRO_POUR_RATE_MOBILE = 18; // mobile (gentler opening on small screens)
const INTRO_POUR_RATE_SMALL = 12; // really small phones (gentlest opening, fewer icons)
const BIRTH_T = 0.9;
const DEATH_T = 3.0;
const LIFE_MIN = 28; // icons live MUCH longer (age very slowly)
const LIFE_MAX = 32;
const MINSCALE = 0.05;
const WALL = 6; // container inset from the section edge (px)

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type ArcSnapshot = {
  ring: Float64Array; // C*2 interleaved x,y (px)
  rc: number; // rest ring radius (tier-dependent) — drives the wire gauge + icon fade
  cx: Float64Array; // N
  cy: Float64Array;
  rot: Float64Array;
  scale: Float64Array; // 0 = dead/invisible
};

type Slot = {
  x: Float64Array;
  y: Float64Array;
  ox: Float64Array;
  oy: Float64Array;
  alive: boolean;
  age: number;
  life: number;
  cx: number;
  cy: number;
  rot: number;
  scale: number;
  pr: number;
  mass: number; // per-icon inertia (random) — affects how far the push throws it
};

export class ArcWorld {
  private rnd: () => number;
  private gx = new Float64Array(C);
  private gy = new Float64Array(C);
  private gox = new Float64Array(C);
  private goy = new Float64Array(C);
  private gtx = new Float64Array(C);
  private gty = new Float64Array(C);
  private rc = ARC_RC; // central ring radius for THIS instance (smaller on tiny phones)
  private g0len = 2 * ARC_RC * Math.sin(Math.PI / C);
  private ringRestArea = 0;
  private RX = new Float64Array(K);
  private RY = new Float64Array(K);
  private rRing: number;
  private slots: Slot[];
  private time = 0;
  private nextSpawn = 0.4;
  private spawnCount = 0;
  private introT = 0; // first-time intro clock (advances only while stepping)
  private introR = 1; // ring radius scale during the intro breath (1 = normal)
  private maxActive = ARC_N; // alive cap (mobile vs desktop, from section width)
  private pourRate = INTRO_POUR_RATE; // intro pour speed-up (mobile vs desktop)
  // container / layout (px)
  private w = 600;
  private h = 400;
  private cx0 = 300;
  private cy0 = 200;
  private rFull = 200;
  private res: { x: number; y: number; w: number; h: number } | null = null;
  private configured = false;
  // snapshot buffers
  private snapRing = new Float64Array(C * 2);
  private snapCx = new Float64Array(ARC_N);
  private snapCy = new Float64Array(ARC_N);
  private snapRot = new Float64Array(ARC_N);
  private snapScale = new Float64Array(ARC_N);

  constructor(seed = 5) {
    this.rnd = mulberry32(seed);
    this.rRing = ICON_R * RP;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      this.RX[k] = Math.cos(a) * this.rRing;
      this.RY[k] = Math.sin(a) * this.rRing;
    }
    this.slots = Array.from({ length: ARC_N }, () => ({
      x: new Float64Array(K),
      y: new Float64Array(K),
      ox: new Float64Array(K),
      oy: new Float64Array(K),
      alive: false,
      age: 0,
      life: 0,
      cx: this.cx0,
      cy: this.cy0,
      rot: 0,
      scale: 0,
      pr: 0,
      mass: 1,
    }));
    this.buildRing(this.cx0, this.cy0);
  }

  private buildRing(cx: number, cy: number) {
    for (let i = 0; i < C; i++) {
      const a = (i / C) * Math.PI * 2 - Math.PI / 2;
      this.gx[i] = cx + Math.cos(a) * this.rc;
      this.gy[i] = cy + Math.sin(a) * this.rc;
      this.gox[i] = this.gx[i];
      this.goy[i] = this.gy[i];
    }
    this.ringRestArea = this.ringArea();
  }

  // ring centre = middle of the LARGEST open region next to the text rect: to its
  // RIGHT (desktop, text on the left) or ABOVE it (mobile, text along the bottom) —
  // so the ring↔text distance matches the lava-lamp section in both layouts.
  private centreFor(w: number, h: number, res: ArcWorld["res"], focusR: number): [number, number] {
    if (!res) return [w / 2, h / 2];
    const gRight = focusR - (res.x + res.w);
    const gAbove = res.y;
    const gBelow = h - (res.y + res.h);
    if (gRight >= gAbove && gRight >= gBelow) return [(res.x + res.w + focusR) / 2, h / 2];
    const cxm = res.x + res.w / 2;
    if (gAbove >= gBelow) return [cxm, res.y / 2];
    return [cxm, (res.y + res.h + h) / 2];
  }

  /** Set/refresh the container from the section size + text rect + content right edge.
   *  Live (no reset): the whole sim is SHIFTED to the new centre so resizing is seamless. */
  config(w: number, h: number, res: ArcWorld["res"], focusR?: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.res = res;
    // three tiers by section width: desktop ≥760, mobile <760, really-small phone <460
    const small = this.w < SMALL_W;
    const mobile = this.w < MOBILE_W;
    this.maxActive = small ? ARC_N_SMALL : mobile ? ARC_N_MOBILE : ARC_N;
    this.pourRate = small ? INTRO_POUR_RATE_SMALL : mobile ? INTRO_POUR_RATE_MOBILE : INTRO_POUR_RATE;
    // ring radius is fixed at FIRST config (resize shifts the ring, never rebuilds it)
    if (!this.configured) {
      this.rc = small ? ARC_RC * RING_SCALE_SMALL : ARC_RC;
      this.g0len = 2 * this.rc * Math.sin(Math.PI / C);
    }
    const [ncx, ncy] = this.centreFor(this.w, this.h, res, focusR ?? this.w);
    this.rFull = Math.min(Math.sqrt(this.rc * this.rc + ARC_N * ICON_R * ICON_R * R_FULL_PAD), Math.min(this.w, this.h) * R_FULL_CAP);
    if (!this.configured) {
      this.cx0 = ncx;
      this.cy0 = ncy;
      this.buildRing(ncx, ncy);
      this.configured = true;
      return;
    }
    const dx = ncx - this.cx0;
    const dy = ncy - this.cy0;
    if (dx !== 0 || dy !== 0) {
      for (let i = 0; i < C; i++) {
        this.gx[i] += dx;
        this.gy[i] += dy;
        this.gox[i] += dx;
        this.goy[i] += dy;
      }
      for (const s of this.slots) {
        if (!s.alive) continue;
        for (let k = 0; k < K; k++) {
          s.x[k] += dx;
          s.y[k] += dy;
          s.ox[k] += dx;
          s.oy[k] += dy;
        }
      }
      this.cx0 = ncx;
      this.cy0 = ncy;
    }
  }

  private ringArea(): number {
    let a = 0;
    for (let i = 0, j = C - 1; i < C; j = i++) a += this.gx[j] * this.gy[i] - this.gx[i] * this.gy[j];
    return a * 0.5;
  }

  private spawn(s: Slot) {
    const ang = this.spawnCount * 2.3999632;
    this.spawnCount++;
    const th = this.rnd() * Math.PI * 2;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    s.mass = MASS_MIN + this.rnd() * (MASS_MAX - MASS_MIN);
    // random burst force, then ÷ mass ⇒ heavier icons launch slower (land closer)
    const burst = (OUTV0 * (BURST_MIN + this.rnd() * (BURST_MAX - BURST_MIN))) / s.mass;
    const vx = Math.cos(ang) * burst * (1 / 60);
    const vy = Math.sin(ang) * burst * (1 / 60);
    const r0 = this.rRing * HITBOX_EMERGE;
    for (let k = 0; k < K; k++) {
      const ux = Math.cos((k / K) * Math.PI * 2) * r0;
      const uy = Math.sin((k / K) * Math.PI * 2) * r0;
      const x = this.cx0 + ux * c - uy * sn;
      const y = this.cy0 + ux * sn + uy * c;
      s.x[k] = x;
      s.y[k] = y;
      s.ox[k] = x - vx;
      s.oy[k] = y - vy;
    }
    s.alive = true;
    s.age = 0;
    s.life = LIFE_MIN + this.rnd() * (LIFE_MAX - LIFE_MIN);
    s.cx = this.cx0;
    s.cy = this.cy0;
    s.rot = th;
    s.scale = MINSCALE;
  }

  private stepRing() {
    const { gx, gy, gox, goy, gtx, gty, cx0, cy0 } = this;
    for (let i = 0; i < C; i++) {
      const vx = (gx[i] - gox[i]) * RING_DAMP;
      const vy = (gy[i] - goy[i]) * RING_DAMP;
      gox[i] = gx[i];
      goy[i] = gy[i];
      gx[i] += vx;
      gy[i] += vy;
    }
    // intro breath scales the whole ring uniformly: edge length × r, area × r²
    const r = this.introR;
    const g0 = this.g0len * r;
    const target = this.ringRestArea * r * r * (1 + BREATHE_AMP * Math.sin(this.time * BREATHE_W));
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < C; i++) {
        const j = (i + 1) % C;
        let dx = gx[j] - gx[i];
        let dy = gy[j] - gy[i];
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const diff = ((d - g0) / d) * 0.5;
        dx *= diff;
        dy *= diff;
        gx[i] += dx;
        gy[i] += dy;
        gx[j] -= dx;
        gy[j] -= dy;
      }
      for (let i = 0; i < C; i++) {
        const ip = (i - 1 + C) % C;
        const iq = (i + 1) % C;
        gtx[i] = gx[i] + SMOOTH_C * (0.5 * (gx[ip] + gx[iq]) - gx[i]);
        gty[i] = gy[i] + SMOOTH_C * (0.5 * (gy[ip] + gy[iq]) - gy[i]);
      }
      for (let i = 0; i < C; i++) {
        gx[i] = gtx[i];
        gy[i] = gty[i];
      }
      const A = this.ringArea();
      let sum2 = 0;
      for (let i = 0; i < C; i++) {
        const ip = (i + 1) % C;
        const im = (i - 1 + C) % C;
        const ax = 0.5 * (gy[ip] - gy[im]);
        const ay = 0.5 * (gx[im] - gx[ip]);
        sum2 += ax * ax + ay * ay;
      }
      if (sum2 > 1e-9) {
        const lambda = ((A - target) / sum2) * K_AREA_C;
        for (let i = 0; i < C; i++) {
          const ip = (i + 1) % C;
          const im = (i - 1 + C) % C;
          gx[i] -= lambda * 0.5 * (gy[ip] - gy[im]);
          gy[i] -= lambda * 0.5 * (gx[im] - gx[ip]);
        }
      }
      // keep the ring parked at its centre
      let mcx = 0;
      let mcy = 0;
      for (let i = 0; i < C; i++) {
        mcx += gx[i];
        mcy += gy[i];
      }
      mcx = mcx / C - cx0;
      mcy = mcy / C - cy0;
      for (let i = 0; i < C; i++) {
        gx[i] -= mcx;
        gy[i] -= mcy;
      }
    }
  }

  step(dt: number) {
    this.time += dt;
    this.introT += dt;
    // ── first-time intro: breathe big (hold icons) → settle back while pouring → normal
    const tIn = INTRO_INFLATE_T;
    const total = tIn + INTRO_DEFLATE_T;
    let pour = false;
    let noDeform = false;
    const inflating = this.introT < tIn;
    if (inflating) {
      const p = this.introT / tIn;
      this.introR = 1 + (INTRO_INFLATE_R - 1) * (p * p * (3 - 2 * p)); // smooth inflate
      noDeform = true;
      this.nextSpawn = this.time; // poised to pour the instant inflation ends
    } else if (this.introT < total) {
      const e = 1 - (this.introT - tIn) / INTRO_DEFLATE_T;
      this.introR = 1 + (INTRO_INFLATE_R - 1) * e * e; // settle back (decelerating)
      noDeform = true;
      pour = true;
    } else {
      this.introR = 1;
    }
    if (!inflating) {
      // no emission while it breathes up; then pour fast, then normal cadence — capped
      // at maxActive (fewer on mobile)
      let aliveCount = 0;
      for (const q of this.slots) if (q.alive) aliveCount++;
      const iv = pour ? SPAWN_INTERVAL / this.pourRate : SPAWN_INTERVAL;
      while (this.time >= this.nextSpawn && aliveCount < this.maxActive) {
        this.nextSpawn += iv;
        const s = this.slots.find((q) => !q.alive);
        if (s) {
          this.spawn(s);
          aliveCount++;
        }
      }
      if (this.time > this.nextSpawn) this.nextSpawn = this.time; // don't bank when capped
    }
    this.stepRing();

    const { gx, gy, RX, RY, slots, cx0, cy0, res } = this;
    const h2 = dt * dt;
    const lo = WALL;
    const hiX = this.w - WALL;
    const hiY = this.h - WALL;
    const rClear = this.rc + ICON_R;

    for (const s of slots) {
      if (!s.alive) {
        s.scale = 0;
        continue;
      }
      s.age += dt;
      if (s.age >= s.life) {
        s.alive = false;
        s.scale = 0;
        continue;
      }
      let sc = Math.min(s.age / BIRTH_T, (s.life - s.age) / DEATH_T);
      sc = sc < 0 ? 0 : sc > 1 ? 1 : sc;
      s.scale = sc;
      let psc: number;
      if (s.age < BIRTH_T) psc = HITBOX_EMERGE + (HITBOX_INIT - HITBOX_EMERGE) * (s.age / BIRTH_T);
      else if (s.life - s.age < DEATH_T) psc = HITBOX_FINAL + (HITBOX_INIT - HITBOX_FINAL) * ((s.life - s.age) / DEATH_T);
      else psc = HITBOX_INIT;
      if (psc < MINSCALE) psc = MINSCALE;
      const L0 = 2 * this.rRing * psc * Math.sin(Math.PI / K);
      const A0 = 0.5 * K * (this.rRing * psc) * (this.rRing * psc) * Math.sin((2 * Math.PI) / K);
      const prEff = PR * ICON_R * psc;

      let bcx = 0;
      let bcy = 0;
      for (let k = 0; k < K; k++) {
        bcx += s.x[k];
        bcy += s.y[k];
      }
      bcx /= K;
      bcy /= K;
      let rdx = bcx - cx0;
      let rdy = bcy - cy0;
      const rr = Math.sqrt(rdx * rdx + rdy * rdy) || 1e-6;
      rdx /= rr;
      rdy /= rr;
      // full force only near the ring (clears it), then EXPONENTIAL decay outward ⇒
      // icons fill a soft cloud (denser near the ring) and don't fly to the edges
      const pushF = (rr < rClear ? OUTPUSH : OUTPUSH * Math.exp(-(rr - rClear) / PUSH_DECAY)) / s.mass;
      const ax = rdx * pushF * h2;
      const ay = rdy * pushF * h2;
      for (let k = 0; k < K; k++) {
        const vx = (s.x[k] - s.ox[k]) * DRAG_ICON;
        const vy = (s.y[k] - s.oy[k]) * DRAG_ICON;
        s.ox[k] = s.x[k];
        s.oy[k] = s.y[k];
        s.x[k] += vx + ax;
        s.y[k] += vy + ay;
      }
      for (let it = 0; it < ITER_ICON; it++) {
        for (let k = 0; k < K; k++) {
          const j = (k + 1) % K;
          let dx = s.x[j] - s.x[k];
          let dy = s.y[j] - s.y[k];
          const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          const diff = ((d - L0) / d) * 0.5;
          dx *= diff;
          dy *= diff;
          s.x[k] += dx;
          s.y[k] += dy;
          s.x[j] -= dx;
          s.y[j] -= dy;
        }
        let a = 0;
        for (let p = 0, q = K - 1; p < K; q = p++) a += s.x[q] * s.y[p] - s.x[p] * s.y[q];
        a *= 0.5;
        let sum2 = 0;
        for (let k = 0; k < K; k++) {
          const ip = (k + 1) % K;
          const im = (k - 1 + K) % K;
          const gx2 = 0.5 * (s.y[ip] - s.y[im]);
          const gy2 = 0.5 * (s.x[im] - s.x[ip]);
          sum2 += gx2 * gx2 + gy2 * gy2;
        }
        if (sum2 > 1e-9) {
          const lambda = ((a - A0) / sum2) * K_AREA_ICON;
          for (let k = 0; k < K; k++) {
            const ip = (k + 1) % K;
            const im = (k - 1 + K) % K;
            s.x[k] -= lambda * 0.5 * (s.y[ip] - s.y[im]);
            s.y[k] -= lambda * 0.5 * (s.x[im] - s.x[ip]);
          }
        }
      }
      // container walls + keep out of the text reserve rectangle
      for (let k = 0; k < K; k++) {
        if (s.x[k] < lo) s.x[k] = lo;
        else if (s.x[k] > hiX) s.x[k] = hiX;
        if (s.y[k] < lo) s.y[k] = lo;
        else if (s.y[k] > hiY) s.y[k] = hiY;
        if (res) {
          const px = s.x[k];
          const py = s.y[k];
          if (px > res.x && px < res.x + res.w && py > res.y && py < res.y + res.h) {
            const dl = px - res.x;
            const dr = res.x + res.w - px;
            const dtp = py - res.y;
            const dbm = res.y + res.h - py;
            const m = Math.min(dl, dr, dtp, dbm);
            if (m === dl) s.x[k] = res.x;
            else if (m === dr) s.x[k] = res.x + res.w;
            else if (m === dtp) s.y[k] = res.y;
            else s.y[k] = res.y + res.h;
          }
        }
      }
      // one-way ring deform
      let best = Infinity;
      let qx = 0;
      let qy = 0;
      let bk = 0;
      let bt = 0;
      for (let k = 0; k < C; k++) {
        const j = (k + 1) % C;
        const ex = gx[j] - gx[k];
        const ey = gy[j] - gy[k];
        const el2 = ex * ex + ey * ey || 1e-9;
        let tt = ((bcx - gx[k]) * ex + (bcy - gy[k]) * ey) / el2;
        tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        const cxp = gx[k] + ex * tt;
        const cyp = gy[k] + ey * tt;
        const dx = bcx - cxp;
        const dy = bcy - cyp;
        const dd = dx * dx + dy * dy;
        if (dd < best) {
          best = dd;
          qx = cxp;
          qy = cyp;
          bk = k;
          bt = tt;
        }
      }
      const dist = Math.sqrt(best) || 1e-6;
      const range = ICON_R * psc + this.rc * 0.3 * 0.5; // half the (tier-scaled) wire gauge
      if (!noDeform && dist < range) {
        const nx = (qx - bcx) / dist;
        const ny = (qy - bcy) / dist;
        const f = RDEF_SOFT * (range - dist) * psc;
        const j = (bk + 1) % C;
        gx[bk] += nx * f * (1 - bt);
        gy[bk] += ny * f * (1 - bt);
        gx[j] += nx * f * bt;
        gy[j] += ny * f * bt;
      }
      s.pr = prEff;
    }

    // icon ↔ icon
    for (let i = 0; i < slots.length; i++) {
      const A = slots[i];
      if (!A.alive) continue;
      const prA = A.pr;
      for (let j = i + 1; j < slots.length; j++) {
        const B = slots[j];
        if (!B.alive) continue;
        const md = prA + B.pr;
        const md2 = md * md;
        for (let a = 0; a < K; a++) {
          for (let b = 0; b < K; b++) {
            const dx = A.x[a] - B.x[b];
            const dy = A.y[a] - B.y[b];
            const d2 = dx * dx + dy * dy;
            if (d2 >= md2 || d2 < 1e-9) continue;
            const d = Math.sqrt(d2);
            const ov = (md - d) * 0.5 * ICON_REPEL;
            const nx = dx / d;
            const ny = dy / d;
            A.x[a] += nx * ov;
            A.y[a] += ny * ov;
            B.x[b] -= nx * ov;
            B.y[b] -= ny * ov;
          }
        }
      }
    }

    for (const s of slots) {
      if (!s.alive) continue;
      let bcx = 0;
      let bcy = 0;
      for (let k = 0; k < K; k++) {
        bcx += s.x[k];
        bcy += s.y[k];
      }
      bcx /= K;
      bcy /= K;
      let cross = 0;
      let dot = 0;
      for (let k = 0; k < K; k++) {
        const rxk = s.x[k] - bcx;
        const ryk = s.y[k] - bcy;
        cross += RX[k] * ryk - RY[k] * rxk;
        dot += RX[k] * rxk + RY[k] * ryk;
      }
      s.cx = bcx;
      s.cy = bcy;
      s.rot = Math.atan2(cross, dot);
    }
  }

  /** reduced-motion: a still cloud around the ring. */
  warm() {
    const ringN = this.slots.length;
    for (let i = 0; i < ringN; i++) {
      const s = this.slots[i];
      const a = (i / ringN) * Math.PI * 2 * 2.3;
      const rad = this.rc + ICON_R * 1.4 + (i / ringN) * (this.rFull - this.rc - ICON_R * 1.4);
      const bcx = this.cx0 + Math.cos(a) * rad;
      const bcy = this.cy0 + Math.sin(a) * rad;
      for (let k = 0; k < K; k++) {
        s.x[k] = bcx + this.RX[k];
        s.y[k] = bcy + this.RY[k];
        s.ox[k] = s.x[k];
        s.oy[k] = s.y[k];
      }
      s.alive = true;
      s.age = 2;
      s.life = 1e9;
      s.cx = bcx;
      s.cy = bcy;
      s.rot = a;
      s.scale = 1;
    }
  }

  snapshot(): ArcSnapshot {
    for (let i = 0; i < C; i++) {
      this.snapRing[i * 2] = this.gx[i];
      this.snapRing[i * 2 + 1] = this.gy[i];
    }
    for (let i = 0; i < ARC_N; i++) {
      const s = this.slots[i];
      this.snapCx[i] = s.cx;
      this.snapCy[i] = s.cy;
      this.snapRot[i] = s.rot;
      this.snapScale[i] = s.scale;
    }
    return { ring: this.snapRing, rc: this.rc, cx: this.snapCx, cy: this.snapCy, rot: this.snapRot, scale: this.snapScale };
  }
}
