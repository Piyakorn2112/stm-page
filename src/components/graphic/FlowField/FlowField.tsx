"use client";

/**
 * FlowField — the "Where it takes form" graphic, a WATERFALL of small STM rings. Physics
 * (top-surface emission, downward push, soft ring↔ring collision, solid walls, recycle)
 * runs in `flowWorker.ts` + `flowEngine.ts`. Here we draw each ring from the ring core
 * (@stm-ring) using its REAL colour system — the dark base wire + per-vertex charge — but
 * STATIC (a fixed phase per ring, no colour drift) and CACHED per seed, so the expensive
 * OKLab work runs once per ring, not every frame. The geometry still morphs (circle →
 * twist) and tumbles. Gated/paused on visibility like the rest.
 */

import { useEffect, useRef } from "react";
import {
  centreLine,
  chargeField,
  makeHover,
  oklabToCss,
  type Hover,
  CX,
  CY,
  R_MID,
  STROKE,
  GRAD_X1,
  GRAD_X2,
  DARK_BASE,
} from "@stm-ring";
import { FLOW_MAX, FLOW_K } from "./flowEngine";
import { prefersDark, prefersReducedMotion, watchColorScheme } from "@/utils/media";
import { sizeCanvas } from "@/utils/canvas";

type Snap = {
  cx: Float64Array;
  cy: Float64Array;
  rad: Float64Array;
  rot: Float64Array;
  morph: Float64Array;
  seed: Int32Array;
  op: Float64Array;
  hx: Float64Array;
  hy: Float64Array;
};

const NSEG = 36; // centre-line samples per ring
const STRANDS = 12; // charge colour strands per ring
const DARK_WIRE: [string, string] = ["#E7EBFC", "#ABB1D4"]; // light rest wire for dark mode
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const withAlpha = (rgb: string, a: number) => (a >= 0.999 ? rgb : `${rgb.slice(0, 3)}a${rgb.slice(3, -1)},${a.toFixed(3)})`);

// per-seed static cache: the ring's fixed-phase formed geometry + charge colours/alpha
type Cache = { hv: Hover; tw0: number; fpx: number[]; fpy: number[]; css: string[]; alpha: number[] };

export default function FlowField({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let baseCols: readonly string[] = prefersDark() ? DARK_WIRE : DARK_BASE;

    const cache = new Map<number, Cache>();
    const ensure = (seed: number): Cache => {
      let c = cache.get(seed);
      if (!c) {
        const hv = makeHover(seed);
        const tw0 = (seed % 100) * 0.07; // fixed phase per ring (varies look, never drifts)
        const cl = centreLine(tw0, tw0, 1, hv, NSEG); // formed local geometry
        const cf = chargeField(tw0, 1, hv, NSEG, false); // real charge (computed ONCE)
        c = { hv, tw0, fpx: cl.px, fpy: cl.py, css: cf.lab.map(oklabToCss), alpha: cf.alpha };
        cache.set(seed, c);
      }
      return c;
    };

    let w = 1;
    let h = 1;
    let frame: Snap | null = null;

    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = sizeCanvas(canvas, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const X = new Float64Array(NSEG);
    const Y = new Float64Array(NSEG);
    const seg = (i: number) => {
      const j = (i + 1) % NSEG;
      const im1 = (i - 1 + NSEG) % NSEG;
      const ip2 = (i + 2) % NSEG;
      ctx.bezierCurveTo(
        X[i] + (X[j] - X[im1]) / 6,
        Y[i] + (Y[j] - Y[im1]) / 6,
        X[j] - (X[ip2] - X[i]) / 6,
        Y[j] - (Y[ip2] - Y[i]) / 6,
        X[j],
        Y[j],
      );
    };

    const drawRing = (
      cx: number,
      cy: number,
      rad: number,
      rot: number,
      morph: number,
      seed: number,
      op: number,
      hx: Float64Array,
      hy: Float64Array,
      base: number,
    ) => {
      const c = ensure(seed);
      let px: number[];
      let py: number[];
      if (morph === 1) {
        px = c.fpx;
        py = c.fpy; // settled at the twist: reuse cached geometry
      } else {
        // rising OR overshooting (the spring briefly carries morph past 1 → over-twist);
        // cap it so extreme seeds can't invert, and draw the live morphing geometry
        const cl = centreLine(c.tw0, c.tw0, morph > 1.12 ? 1.12 : morph, c.hv, NSEG);
        px = cl.px;
        py = cl.py;
      }
      const sf = rad / R_MID;
      const co = Math.cos(rot);
      const si = Math.sin(rot);
      // soft-body deformation: warp the ring radially to match the verlet hull, fading
      // OUT as it morphs into the twist — so the untwisted state squishes (lava-lamp),
      // the formed ring is precise, and the morph is a real transition between the two.
      const mc = morph < 0 ? 0 : morph > 1 ? 1 : morph;
      const defW = 1 - mc * mc * (3 - 2 * mc);
      const TAU = Math.PI * 2;
      for (let i = 0; i < NSEG; i++) {
        let lx = px[i] - CX;
        let ly = py[i] - CY;
        if (defW > 0.001) {
          let wa = Math.atan2(ly, lx) + rot;
          wa = ((wa % TAU) + TAU) % TAU;
          const t = (wa / TAU) * FLOW_K;
          const k0 = Math.floor(t) % FLOW_K;
          const k1 = (k0 + 1) % FLOW_K;
          const fr = t - Math.floor(t);
          const r0 = Math.hypot(hx[base + k0], hy[base + k0]);
          const r1 = Math.hypot(hx[base + k1], hy[base + k1]);
          const f = 1 + ((r0 * (1 - fr) + r1 * fr) - 1) * defW;
          lx *= f;
          ly *= f;
        }
        X[i] = cx + sf * (lx * co - ly * si);
        Y[i] = cy + sf * (lx * si + ly * co);
      }
      ctx.globalAlpha = op;
      ctx.lineWidth = STROKE * sf;
      // base wire — dark ramp (light in dark mode), gradient along the ring's own x-axis
      const g0lx = (GRAD_X1 - CX) * sf;
      const g1lx = (GRAD_X2 - CX) * sf;
      const bg = ctx.createLinearGradient(cx + g0lx * co, cy + g0lx * si, cx + g1lx * co, cy + g1lx * si);
      bg.addColorStop(0, baseCols[0]);
      bg.addColorStop(1, baseCols[1]);
      ctx.strokeStyle = bg;
      ctx.beginPath();
      ctx.moveTo(X[0], Y[0]);
      for (let i = 0; i < NSEG; i++) seg(i);
      ctx.closePath();
      ctx.stroke();
      // charge strands — real per-vertex colour (cached), alpha baked into stops (no
      // per-segment globalAlpha ⇒ no seam); fades in with morph
      const m = clamp01(morph);
      const step = Math.max(1, Math.round(NSEG / STRANDS));
      for (let start = 0; start < NSEG; start += step) {
        const end = Math.min(start + step, NSEG);
        let maxA = 0;
        for (let k = start; k <= end; k++) {
          const a = c.alpha[k % NSEG];
          if (a > maxA) maxA = a;
        }
        if (maxA * m < 0.01) continue;
        const span = end - start || 1;
        const grad = ctx.createLinearGradient(X[start], Y[start], X[end % NSEG], Y[end % NSEG]);
        for (let k = start; k <= end; k++) grad.addColorStop(clamp01((k - start) / span), withAlpha(c.css[k % NSEG], c.alpha[k % NSEG] * m));
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(X[start], Y[start]);
        for (let i = start; i < end; i++) seg(i);
        ctx.stroke();
      }
    };

    const render = () => {
      if (!frame) return;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const { cx, cy, rad, rot, morph, seed, op, hx, hy } = frame;
      for (let i = 0; i < FLOW_MAX; i++) {
        if (op[i] <= 0.02 || rad[i] <= 0.5) continue;
        drawRing(cx[i], cy[i], rad[i], rot[i], morph[i], seed[i], op[i], hx, hy, i * FLOW_K);
      }
      ctx.globalAlpha = 1;
    };

    layout();

    let worker: Worker | null = null;
    let raf = 0;
    let rendering = false;
    let active = false;
    let inView = false;
    let tabVisible = typeof document === "undefined" || !document.hidden;
    const pushSize = () => worker?.postMessage({ type: "resize", w, h });
    const ensureWorker = () => {
      if (worker) return;
      worker = new Worker(new URL("./flowWorker.ts", import.meta.url), { type: "module" });
      worker.postMessage({ type: "config", reduced, seed: 11 });
      pushSize();
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "frame") {
          frame = e.data as Snap;
          if (reduced) render();
        }
      };
    };
    const renderLoop = () => {
      if (!rendering) return;
      render();
      raf = requestAnimationFrame(renderLoop);
    };
    const sync = () => {
      const go = inView && tabVisible;
      if (go === active) return;
      active = go;
      if (go) {
        ensureWorker();
        worker!.postMessage({ type: "start" });
        if (!reduced && !rendering) {
          rendering = true;
          raf = requestAnimationFrame(renderLoop);
        }
      } else {
        worker?.postMessage({ type: "stop" });
        rendering = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        sync();
      },
      { threshold: 0, rootMargin: "0px" },
    );
    io.observe(wrap);
    const onVis = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => {
      layout();
      pushSize();
      render();
    });
    ro.observe(wrap);
    const onScheme = () => {
      baseCols = prefersDark() ? DARK_WIRE : DARK_BASE;
      render();
    };
    const stopScheme = watchColorScheme(onScheme);

    return () => {
      rendering = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stopScheme();
      worker?.terminate();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true" style={{ width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
