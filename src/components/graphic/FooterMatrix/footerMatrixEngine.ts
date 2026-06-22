/**
 * footerMatrixEngine — a featherweight, GREYSCALE field of little twisted rings that
 * sits FAINT behind the site footer, running Conway's GAME OF LIFE across the lattice.
 *
 * Each grid cell is a small `centreLine` twisted-ring glyph (the same sprite palette
 * the lab `/matrix` display uses). A LIVE cell paints its glyph bright; a dead cell
 * rests at the barely-there faint level. The population evolves by Life's rules; when
 * a cell dies it doesn't snap off — it steps down through the phosphor levels over a
 * couple generations, leaving a soft wake.
 *
 * SPARSE — by aesthetic AND by cost:
 *   • the state is a Set of live cell indices; a generation only visits live cells and
 *     their neighbours (neighbour counts accumulate via a touched-list, never a full
 *     grid scan). Cost scales with the (small) live population, not the grid.
 *   • it's GENERATION-driven, not frame-driven: the worker steps once every ~genMs
 *     (≈2–3/s, far under any fps cap) and between steps NOTHING changes, so the matrix
 *     costs nothing. Only cells whose level changed this generation repaint.
 *   • low seed density + a soft population cap + occasional tiny "soup" injections keep
 *     it alive and sparse — it never fizzles to nothing or crowds into mush.
 *
 * No colour, no pixel readback, no tint cache: brightness is pure `globalAlpha` over a
 * single grey ink (rebuilt on theme change). Runs in a worker on a transferred
 * OffscreenCanvas (footerMatrixWorker). Greyscale + light/dark via `setTheme`. Cells
 * over the footer TEXT are kept permanently dead (`setReserves`) so copy stays readable
 * and Life flows around it.
 */

import { centreLine, makeHover, SETTLE_POSE, type Hover } from "@stm-ring";

export type FooterMatrixConfig = {
  cell: number; // css px pitch of one cell
  shapeCount: number; // distinct twisted-ring glyphs in the lattice
  faintAlpha: number; // dead/resting glyph opacity (the backdrop — keep low)
  aliveAlpha: number; // a live cell's opacity (dead cells fade down toward faint)
  seedDensity: number; // fraction of cells alive in the initial soup
  genMs: number; // ms per Game-of-Life generation (read by the worker)
  injectEvery: number; // inject a fresh soup patch every N generations (0 disables)
  injectPatches: number; // how many 3×3 soup patches per injection
  maxFrac: number; // skip injection once the live fraction exceeds this (stay sparse)
  maxAge: number; // a cell dies after this many generations continuously alive (kills
  // still-lifes ⇒ the field can never freeze; oscillators/gliders reset age so they live on)
  minChurn: number; // if a generation changes fewer than this many cells, inject extra (anti-stall)
};

export const DEFAULT_CONFIG: FooterMatrixConfig = {
  cell: 24,
  shapeCount: 14,
  faintAlpha: 0.045,
  aliveAlpha: 0.24,
  seedDensity: 0.1,
  genMs: 240,
  injectEvery: 3,
  injectPatches: 1,
  maxFrac: 0.16,
  maxAge: 22,
  minChurn: 4,
};

const SPRITE_N = 120; // centre-line samples per lattice sprite
const WIRE_FRAC = 0.085; // uniform wire gauge for EVERY sprite, fraction of the cell
const LMAX = 3; // a live cell's level; dead cells fade LMAX→0

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// Cheap stable per-cell hash → glyph + baked rotation choice.
function cellHash(c: number, r: number): number {
  let h = (c * 374761393 + r * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  return (h ^ (h >>> 16)) >>> 0;
}

type Sprite = OffscreenCanvas;

// Geometry-only twist score (settled-pose perimeter) so the lattice palette spreads
// from gentle loops to busier self-crossing shapes — same idea as the lab engine.
function twistScore(h: Hover): number {
  const { px, py } = centreLine(SETTLE_POSE.t, SETTLE_POSE.twistT, SETTLE_POSE.morph, h, 96);
  let per = 0;
  for (let i = 0; i < px.length; i++) {
    const j = (i + 1) % px.length;
    per += Math.hypot(px[j] - px[i], py[j] - py[i]);
  }
  return per;
}

// One settled centre-line as a closed grey polyline, bbox-fitted into a sizeDev box
// with a uniform wire gauge. Stroked in the theme ink directly — brightness is then
// just globalAlpha at paint time (no recolour pass).
function rasterizeSprite(h: Hover, sizeDev: number, ink: string): Sprite {
  const { px, py } = centreLine(SETTLE_POSE.t, SETTLE_POSE.twistT, SETTLE_POSE.morph, h, SPRITE_N);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < px.length; i++) {
    if (px[i] < minX) minX = px[i];
    if (px[i] > maxX) maxX = px[i];
    if (py[i] < minY) minY = py[i];
    if (py[i] > maxY) maxY = py[i];
  }
  const pad = 0.17;
  const inner = sizeDev * (1 - pad * 2);
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const scale = inner / Math.max(bw, bh);
  const ox = (sizeDev - bw * scale) / 2 - minX * scale;
  const oy = (sizeDev - bh * scale) / 2 - minY * scale;

  const cv = new OffscreenCanvas(sizeDev, sizeDev);
  const ctx = cv.getContext("2d")!;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, sizeDev * WIRE_FRAC);
  ctx.beginPath();
  ctx.moveTo(px[0] * scale + ox, py[0] * scale + oy);
  for (let i = 1; i < px.length; i++) ctx.lineTo(px[i] * scale + ox, py[i] * scale + oy);
  ctx.closePath();
  ctx.stroke();
  return cv;
}

export class FooterMatrixEngine {
  private cfg: FooterMatrixConfig;
  private ctx: OffscreenCanvasRenderingContext2D;
  private alpha: number[]; // opacity by level (0 = dead/resting .. LMAX = alive)

  private cols = 0;
  private rows = 0;
  private sizeDev = 0;
  private sprites: Sprite[] = [];

  private cellShape = new Uint8Array(0);
  private cellRot = new Uint8Array(0); // baked rotation 0..3
  private cellLevel = new Uint8Array(0); // 0 dead/resting .. LMAX alive
  private live = new Set<number>(); // live cells (Game of Life state)
  private active = new Set<number>(); // cells with level > 0 (alive OR still fading)
  private blocked = new Uint8Array(0); // 1 ⇒ a cell over text: kept dead so copy stays clear

  // Sparse neighbour-count scratch (reset via a touched-list, never a full scan).
  private counts = new Int8Array(0);
  private touched: number[] = [];
  private cellAge = new Uint16Array(0); // generations a cell has been continuously alive
  private maxLive = 0;
  private gen = 0;
  private lastChurn = 0; // cells that changed last generation (drives the anti-stall inject)

  private ink = "#0a0a0b";

  constructor(canvas: OffscreenCanvas, cfg: Partial<FooterMatrixConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.cfg.shapeCount = clamp(Math.round(this.cfg.shapeCount), 1, 32);
    this.ctx = canvas.getContext("2d")!;
    const { faintAlpha, aliveAlpha } = this.cfg;
    this.alpha = [faintAlpha, aliveAlpha * 0.4, aliveAlpha * 0.7, aliveAlpha];
  }

  /** Greyscale ink for the current theme; rebuilds sprites + repaints if sized. */
  setTheme(dark: boolean) {
    this.ink = dark ? "#e8e9ed" : "#0a0a0b";
    if (this.cols > 0) {
      this.buildSprites();
      this.paintAll();
    }
  }

  private buildSprites() {
    const CANDIDATES = 64;
    const scored = Array.from({ length: CANDIDATES }, (_, i) => {
      const h = makeHover(i + 1);
      return { h, s: twistScore(h) };
    }).sort((a, b) => a.s - b.s);
    const n = this.cfg.shapeCount;
    this.sprites = [];
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : i / (n - 1);
      const h = scored[Math.round(f * (CANDIDATES - 1) * 0.82)].h;
      this.sprites.push(rasterizeSprite(h, this.sizeDev, this.ink));
    }
  }

  /** Size to the footer box: recompute the grid, rebuild sprites, reseed, repaint all. */
  setSize(vw: number, vh: number, dpr: number) {
    const { cell } = this.cfg;
    this.cols = Math.max(1, Math.floor(vw / cell));
    this.rows = Math.max(1, Math.floor(vh / cell));
    this.sizeDev = Math.round(cell * dpr);

    const cv = this.ctx.canvas;
    cv.width = this.cols * this.sizeDev;
    cv.height = this.rows * this.sizeDev;

    this.buildSprites();

    const count = this.cols * this.rows;
    this.cellShape = new Uint8Array(count);
    this.cellRot = new Uint8Array(count);
    this.cellLevel = new Uint8Array(count);
    this.blocked = new Uint8Array(count);
    this.counts = new Int8Array(count);
    this.cellAge = new Uint16Array(count);
    this.touched = [];
    this.live.clear();
    this.active.clear();
    this.gen = 0;
    this.lastChurn = 0;
    this.maxLive = Math.floor(this.cfg.maxFrac * count);
    for (let i = 0; i < count; i++) {
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      const h = cellHash(c, r);
      this.cellShape[i] = h % this.cfg.shapeCount;
      this.cellRot[i] = (h >>> 8) & 3;
    }
    // seed a sparse soup
    for (let i = 0; i < count; i++) {
      if (Math.random() < this.cfg.seedDensity) {
        this.live.add(i);
        this.cellLevel[i] = LMAX;
        this.active.add(i);
      }
    }
    this.paintAll();
  }

  /**
   * Mark the cells covered by the footer's text rects (CSS px relative to the canvas)
   * so Life never lights them — text stays readable on the faint lattice. Any live or
   * fading cell now under text is reset to rest immediately. `pad` keeps it tight.
   */
  setReserves(rects: { x: number; y: number; w: number; h: number }[], pad = 2) {
    if (this.cols === 0) return;
    this.blocked.fill(0);
    const cell = this.cfg.cell;
    for (const rc of rects) {
      const c0 = Math.max(0, Math.floor((rc.x - pad) / cell));
      const c1 = Math.min(this.cols - 1, Math.floor((rc.x + rc.w + pad) / cell));
      const r0 = Math.max(0, Math.floor((rc.y - pad) / cell));
      const r1 = Math.min(this.rows - 1, Math.floor((rc.y + rc.h + pad) / cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) this.blocked[r * this.cols + c] = 1;
      }
    }
    // evict anything currently lit under text
    this.live.forEach((idx) => {
      if (this.blocked[idx]) this.live.delete(idx);
    });
    this.active.forEach((idx) => {
      if (!this.blocked[idx]) return;
      this.cellLevel[idx] = 0;
      this.paintCell(idx);
      this.active.delete(idx);
    });
  }

  private paintAll() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    for (let i = 0; i < this.cellLevel.length; i++) this.paintCell(i);
  }

  private paintCell(i: number) {
    const c = i % this.cols;
    const r = (i / this.cols) | 0;
    const x = c * this.sizeDev;
    const y = r * this.sizeDev;
    const s = this.sizeDev;
    const ctx = this.ctx;
    ctx.clearRect(x, y, s, s);
    ctx.globalAlpha = this.alpha[this.cellLevel[i]];
    const rot = this.cellRot[i];
    if (rot === 0) {
      ctx.drawImage(this.sprites[this.cellShape[i]], x, y);
    } else {
      // bake the rotation in at paint time — paints are rare (dirty cells only)
      ctx.translate(x + s / 2, y + s / 2);
      ctx.rotate((rot * Math.PI) / 2);
      ctx.drawImage(this.sprites[this.cellShape[i]], -s / 2, -s / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  // Sprinkle a few small random soup patches into `next` (skipping text cells) so the
  // field keeps seeding fresh structures instead of settling into static ash.
  private inject(next: Set<number>) {
    const cols = this.cols, rows = this.rows;
    for (let p = 0; p < this.cfg.injectPatches; p++) {
      const cc = (Math.random() * cols) | 0;
      const rr = (Math.random() * rows) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (Math.random() >= 0.45) continue;
          const c = cc + dc, r = rr + dr;
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          const idx = r * cols + c;
          if (!this.blocked[idx]) next.add(idx);
        }
      }
    }
  }

  /** Advance one Game-of-Life generation (sparse) and repaint only changed cells. */
  step() {
    if (this.cols === 0) return;
    const cols = this.cols, rows = this.rows;
    const counts = this.counts, touched = this.touched;

    // reset only the cells we touched last generation
    for (let k = 0; k < touched.length; k++) counts[touched[k]] = 0;
    touched.length = 0;

    // accumulate neighbour counts from the (small) live set only
    for (const idx of this.live) {
      const c = idx % cols, r = (idx / cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          const cc = c + dc;
          if (cc < 0 || cc >= cols) continue;
          const nidx = rr * cols + cc;
          if (counts[nidx] === 0) touched.push(nidx);
          counts[nidx]++;
        }
      }
    }

    // apply the rules: survivors (2–3 neighbours) + births (exactly 3, dead, not text)
    const next = new Set<number>();
    const age = this.cellAge, maxAge = this.cfg.maxAge;
    for (const idx of this.live) {
      const ct = counts[idx];
      // a survivor that has been alive too long dies of old age — this is what kills
      // still-lifes so the field can never freeze (oscillator cells reset age on rebirth).
      if ((ct === 2 || ct === 3) && age[idx] < maxAge) next.add(idx);
    }
    for (let k = 0; k < touched.length; k++) {
      const idx = touched[k];
      if (counts[idx] === 3 && !this.live.has(idx) && !this.blocked[idx]) next.add(idx);
    }

    // keep it alive, sparse AND moving: inject on a timer OR whenever the last
    // generation barely changed (anti-stall), staying under the population cap.
    this.gen++;
    const stalled = this.lastChurn < this.cfg.minChurn;
    const onTimer = this.cfg.injectEvery > 0 && this.gen % this.cfg.injectEvery === 0;
    if ((onTimer || stalled) && this.live.size < this.maxLive) this.inject(next);

    // render the diff: births/survivors go bright; everything else fades a step
    const lvls = this.cellLevel, active = this.active;
    let churn = 0;
    for (const idx of next) {
      if (lvls[idx] !== LMAX) {
        lvls[idx] = LMAX;
        this.paintCell(idx);
        churn++;
      }
      active.add(idx);
      // age: survivors grow older; freshly born/injected cells reset to 0
      age[idx] = this.live.has(idx) ? age[idx] + 1 : 0;
    }
    for (const idx of active) {
      if (next.has(idx)) continue; // alive ⇒ already handled
      const nl = lvls[idx] - 1;
      lvls[idx] = nl;
      this.paintCell(idx);
      churn++;
      if (nl <= 0) active.delete(idx);
    }

    this.lastChurn = churn;
    this.live = next;
  }
}
