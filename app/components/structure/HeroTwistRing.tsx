"use client";

/**
 * HeroTwistRing — Canvas2D renderer + "Still Water" reveal for the hero ring.
 *
 *  1. STUTTER (rendering ceiling). The SVG hero rewrites ~240 <path> `d` strings
 *     + gradient stops every frame (~2,600 setAttribute); path `d` mutation runs
 *     the FULL style→layout→paint→raster pipeline, so the cost is SVG re-raster,
 *     not JS (~1.3ms). This draws the SAME geometry to ONE <canvas>: one
 *     composited layer, no DOM mutation, over/under depth for free via draw
 *     order, and the ~50% transparent strands are SKIPPED (the base shows
 *     through). Reuses the core's centreLine / chargeField / oklabToCss —
 *     stmRingCore + StmRing are untouched.
 *
 *  2. FEEL. Bloom + relax are damped SPRINGS (exponential settle ⇒ soft landing,
 *     no "wall"); spin/breathe are DECOUPLED to a constant ambient rate; the
 *     charge colour LAGS the geometry so the shape forms then colour pours in.
 *
 *  3. MORPH. A seed change while already formed glides shape→shape with a PROPER
 *     OKLab A→B blend (geometry AND charge) — identical maths to the grid's
 *     MorphRing, so this renderer is grid-grade (could replace MorphRing).
 *
 * Driven like the SVG hero: a `seed` value blooms into that shape; null relaxes
 * to the rest circle.
 */

import { useEffect, useRef } from "react";
import {
  VIEW_W,
  VIEW_H,
  CY,
  GRAD_X1,
  GRAD_X2,
  STROKE,
  DARK_BASE,
  centreLine,
  chargeField,
  oklabToCss,
  makeHover,
  type Hover,
} from "@stm-ring";

// ── "Still Water" reveal ─────────────────────────────────────────────────────
// Bloom + relax are damped SPRINGS (exponential settle ⇒ soft landing, no
// "wall"). Enter is a touch QUICKER with a subtle bounce; exit is SLOWER and
// critically damped (no overshoot), so the two read as matched. OMEGA = natural
// frequency (rad/s; higher = quicker); ZETA = damping ratio (lower = bouncier;
// 1 = no overshoot).
// OMEGA_IN is deliberately MODERATE: on a big ring a fast bloom moves the wire
// ~11px/frame at peak (frame-skip / per-frame drift judder), so we slow it ⇒
// smaller per-frame delta ⇒ smooth. (Lower still if it judders; raise for snappier.)
const SPRING_OMEGA_IN = 4.0;
const SPRING_ZETA_IN = 0.78; // subtle (~1%) overshoot — keeps a hint of bounce
const SPRING_OMEGA_OUT = 5.2; // exit a touch quicker (was a bit too slow)
const SPRING_ZETA_OUT = 1.0; // critically damped — soft, no overshoot
// Charge (colour): lags the geometry on the way in, fades a touch faster out.
const CHARGE_LAG_MS = 150;
const CHARGE_IN_MS = 820;
const CHARGE_OUT_MS = 700;
// Shape→shape glide (the grid's morph) — one continuous eased blend.
const GLIDE_MS = 1200;
// twistT advance rate. twistT drives BOTH the gentle spin (spinSpeed·twistT) AND
// the colour drift (colorDrift·twistT), so it must be lively or the bloomed ring
// freezes during a hold. 1.0 matches the SVG hero's full-bloom rate; DECOUPLED
// here (constant, not morph·dt) so it stays alive without ACCELERATING the bloom.
const AMBIENT_SPIN = 1.0;
const REST_EPS = 0.12; // below this the wire is "at rest" (a new seed blooms)

// ── easing (for the charge + the glide; the morph itself is a spring) ─────────
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number, c1 = 0.4) => {
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};

type Tween = { from: number; start: number; dur: number; target: number; ease: (p: number) => number };
const evalTween = (tw: Tween | null, now: number, fallback: number): number => {
  if (!tw) return fallback;
  if (now <= tw.start) return tw.from; // lag window (charge begins in the future)
  const p = clamp01((now - tw.start) / tw.dur);
  return tw.from + (tw.target - tw.from) * tw.ease(p);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// rgb(…) → rgba(…, a)
const withAlpha = (rgb: string, a: number) =>
  a >= 0.999 ? rgb : `${rgb.slice(0, 3)}a${rgb.slice(3, -1)},${a.toFixed(3)})`;

export default function HeroTwistRing({
  seed = null,
  size = 540,
  baseColors = DARK_BASE,
  segments = 560,
  pieces = 240,
  grayscale = false,
  paused = false,
  className,
  style,
}: {
  /** A value blooms the ring into that shape; null relaxes to the rest circle. */
  seed?: string | number | null;
  size?: number;
  baseColors?: readonly [string, string] | readonly string[];
  segments?: number;
  pieces?: number;
  grayscale?: boolean;
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation state (refs ⇒ the rAF loop reads the latest without re-subscribing).
  const morphRef = useRef(0); // 0 = circle, 1 = flower (geometry amplitude)
  const chargeRef = useRef(0); // colour intensity (lags geometry)
  const twistTRef = useRef(0); // accumulates at AMBIENT_SPIN — decoupled from morph
  const blendRef = useRef(0); // 0 = hoverA, 1 = hoverB (shape glide)
  const hoverARef = useRef<Hover>(makeHover(0));
  const hoverBRef = useRef<Hover>(makeHover(0));
  const seedKeyRef = useRef<string | null>(null);

  // Morph spring (both directions). target/omega/zeta are set when a spring starts.
  const morphVelRef = useRef(0);
  const springActiveRef = useRef(false);
  const springTargetRef = useRef(0);
  const springOmegaRef = useRef(SPRING_OMEGA_IN);
  const springZetaRef = useRef(SPRING_ZETA_IN);
  const chargeTweenRef = useRef<Tween | null>(null);
  const blendTweenRef = useRef<Tween | null>(null);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Live-tunable inputs the loop reads each frame.
  const baseColorsRef = useRef(baseColors);
  const grayRef = useRef(grayscale);
  const segRef = useRef(segments);
  const pieceRef = useRef(pieces);
  const sizeRef = useRef(size);
  useEffect(() => {
    baseColorsRef.current = baseColors;
    grayRef.current = grayscale;
    segRef.current = segments;
    pieceRef.current = pieces;
    sizeRef.current = size;
  }, [baseColors, grayscale, segments, pieces, size]);

  // React to seed changes → start the appropriate spring / glide.
  useEffect(() => {
    const key = seed == null ? null : String(seed);
    const now = performance.now();
    if (key == null) {
      // relax: spring back to the circle (slower, critically damped ⇒ soft)
      springTargetRef.current = 0;
      springOmegaRef.current = SPRING_OMEGA_OUT;
      springZetaRef.current = SPRING_ZETA_OUT;
      springActiveRef.current = true;
      chargeTweenRef.current = { from: chargeRef.current, start: now, dur: CHARGE_OUT_MS, target: 0, ease: easeInOutQuint };
      seedKeyRef.current = null;
      return;
    }
    if (morphRef.current < REST_EPS) {
      // bloom from rest: spring in (quicker, subtle bounce), colour pours in late
      hoverARef.current = makeHover(key);
      blendRef.current = 0;
      blendTweenRef.current = null;
      springTargetRef.current = 1;
      springOmegaRef.current = SPRING_OMEGA_IN;
      springZetaRef.current = SPRING_ZETA_IN;
      springActiveRef.current = true;
      chargeTweenRef.current = { from: chargeRef.current, start: now + CHARGE_LAG_MS, dur: CHARGE_IN_MS, target: 1, ease: easeOutCubic };
    } else if (key !== seedKeyRef.current) {
      // already formed → glide shape→shape (morph holds at ~1; the grid's morph)
      hoverBRef.current = makeHover(key);
      blendRef.current = 0;
      springActiveRef.current = false;
      blendTweenRef.current = { from: 0, start: now, dur: GLIDE_MS, target: 1, ease: (p) => easeOutBack(smoothstep(p)) };
      chargeTweenRef.current = { from: chargeRef.current, start: now, dur: GLIDE_MS, target: 1, ease: easeOutCubic };
    }
    seedKeyRef.current = key;
  }, [seed]);

  // The render loop. Mounted once; everything time-varying comes from refs.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap ⇒ phones stay cheap

    let lastSize = -1;
    const ensureCanvasSize = () => {
      const cssW = sizeRef.current;
      if (cssW === lastSize) return;
      lastSize = cssW;
      const cssH = (cssW * VIEW_H) / VIEW_W;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    // Catmull-Rom Bézier segment i→i+1 (matches the core's `assemble`, so the
    // canvas wire is the same curve as the SVG one).
    const appendSeg = (px: number[], py: number[], i: number, N: number, s: number) => {
      const j = (i + 1) % N;
      const im1 = (i - 1 + N) % N;
      const ip2 = (i + 2) % N;
      const c1x = px[i] + (px[j] - px[im1]) / 6;
      const c1y = py[i] + (py[j] - py[im1]) / 6;
      const c2x = px[j] - (px[ip2] - px[i]) / 6;
      const c2y = py[j] - (py[ip2] - py[i]) / 6;
      ctx.bezierCurveTo(c1x * s, c1y * s, c2x * s, c2y * s, px[j] * s, py[j] * s);
    };

    const drawFrame = (now: number, dt: number) => {
      ensureCanvasSize();
      const cssW = sizeRef.current;
      const s = cssW / VIEW_W;
      const N = segRef.current;
      const K = pieceRef.current;
      const gray = grayRef.current;
      const colors = baseColorsRef.current;

      twistTRef.current += AMBIENT_SPIN * dt; // constant ambient spin (decoupled)
      const tw = twistTRef.current;

      // Morph: bloom/relax = damped spring (soft exponential settle); glide holds it.
      if (springActiveRef.current) {
        const o = springOmegaRef.current;
        const z = springZetaRef.current;
        const tgt = springTargetRef.current;
        const acc = o * o * (tgt - morphRef.current) - 2 * z * o * morphVelRef.current;
        morphVelRef.current += acc * dt;
        morphRef.current += morphVelRef.current * dt;
        if (Math.abs(tgt - morphRef.current) < 0.0015 && Math.abs(morphVelRef.current) < 0.02) {
          morphRef.current = tgt;
          morphVelRef.current = 0;
          springActiveRef.current = false;
        }
      }
      chargeRef.current = evalTween(chargeTweenRef.current, now, chargeRef.current);
      const morph = morphRef.current;
      const charge = chargeRef.current;

      // Geometry + per-vertex colour (lerp A→B while gliding — grid-grade).
      const A = centreLine(tw, tw, morph, hoverARef.current, N);
      const fa = chargeField(tw, charge, hoverARef.current, N, gray);
      let px = A.px;
      let py = A.py;
      let lab = fa.lab;
      let alpha = fa.alpha;
      if (blendTweenRef.current) {
        const e = evalTween(blendTweenRef.current, now, blendRef.current);
        blendRef.current = e;
        const B = centreLine(tw, tw, morph, hoverBRef.current, N);
        const fb = chargeField(tw, charge, hoverBRef.current, N, gray);
        px = new Array<number>(N);
        py = new Array<number>(N);
        lab = new Array(N);
        alpha = new Array<number>(N);
        for (let i = 0; i < N; i++) {
          px[i] = lerp(A.px[i], B.px[i], e);
          py[i] = lerp(A.py[i], B.py[i], e);
          // OKLab blend (componentwise) — exactly buildRingMorph's mix.
          lab[i] = {
            L: lerp(fa.lab[i].L, fb.lab[i].L, e),
            a: lerp(fa.lab[i].a, fb.lab[i].a, e),
            b: lerp(fa.lab[i].b, fb.lab[i].b, e),
          };
          alpha[i] = lerp(fa.alpha[i], fb.alpha[i], e);
        }
        if (e >= 1) {
          hoverARef.current = hoverBRef.current;
          blendTweenRef.current = null;
          blendRef.current = 0;
        }
      }
      const css = lab.map(oklabToCss);

      // Paint.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW + 2, (cssW * VIEW_H) / VIEW_W + 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = STROKE * s;

      // 1) the whole wire in the dark base ramp (drawn ONCE, under the charge).
      const baseGrad = ctx.createLinearGradient(GRAD_X1 * s, CY * s, GRAD_X2 * s, CY * s);
      baseGrad.addColorStop(0, colors[0]);
      baseGrad.addColorStop(1, colors[1]);
      ctx.strokeStyle = baseGrad;
      ctx.beginPath();
      ctx.moveTo(px[0] * s, py[0] * s);
      for (let i = 0; i < N; i++) appendSeg(px, py, i, N, s);
      ctx.closePath();
      ctx.stroke();

      // 2) the charge strands, in arc order (later arcs paint over earlier ⇒ the
      //    same over/under depth as SVG). TRANSPARENT strands are skipped entirely
      //    (the base already shows through) — the big rasterisation win.
      const step = Math.max(1, Math.round(N / K));
      for (let start = 0; start < N; start += step) {
        const end = Math.min(start + step, N);
        let maxA = 0;
        for (let k = start; k <= end; k++) {
          const a = alpha[k % N];
          if (a > maxA) maxA = a;
        }
        if (maxA < 0.004) continue; // invisible ⇒ don't paint
        const span = end - start;
        const grad = ctx.createLinearGradient(px[start] * s, py[start] * s, px[end % N] * s, py[end % N] * s);
        for (let k = start; k <= end; k++) {
          grad.addColorStop(clamp01((k - start) / span), withAlpha(css[k % N], alpha[k % N]));
        }
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px[start] * s, py[start] * s);
        for (let i = start; i < end; i++) appendSeg(px, py, i, N, s);
        ctx.stroke();
      }
    };

    // Reduced motion: paint one settled frame and stop.
    if (reduced) {
      morphRef.current = 1;
      chargeRef.current = 1;
      twistTRef.current = 10;
      if (seed != null) hoverARef.current = makeHover(String(seed));
      drawFrame(performance.now(), 0);
      return;
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (pausedRef.current) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drawFrame(now, dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ display: "block", ...style }} />;
}
