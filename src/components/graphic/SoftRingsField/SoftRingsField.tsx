"use client";

/**
 * SoftRingsField — the brand graphic for the first section: three pressurised
 * soft-body wire rings (orange = creativity, blue = engineering, purple =
 * intelligence) plus a small ink blob, in a lava-lamp cycle. The physics lives in
 * `softBody.ts` (engine, no DOM) and runs OFF THE MAIN THREAD in a Web Worker
 * (`softBodyWorker.ts`); this component only strokes the position snapshots the
 * worker posts (cheap). Falls back to running the engine on the main thread where
 * Web Workers aren't available.
 *
 * RESOURCE DISCIPLINE (the brief): it must NOT compete with the hero. So:
 *   • It does NO physics work at mount — the heavy settle is DEFERRED, so it can
 *     never block the main thread during the hero entrance (this content mounts
 *     right as the hero ring morphs back to rest; a synchronous warm there froze it).
 *   • Everything is gated on visibility (IntersectionObserver): the first time the
 *     canvas scrolls into view the rAF loop starts and the blobs simply fall in and
 *     settle LIVE; scrolled away ⇒ the loop is cancelled. So it only ever runs once
 *     the user has scrolled DOWN to it, never alongside the hero.
 *   • prefers-reduced-motion ⇒ warm once (only when first visible) + a static frame.
 *
 * Self-contained: no dependency on the ring core (separate engine, per owner rule).
 */

import { useEffect, useRef } from "react";
import { SoftBodyWorld, SIZE, WIRE, type SoftRingState } from "./softBody";
import { prefersReducedMotion, watchColorScheme } from "@/utils/media";
import { sizeCanvas } from "@/utils/canvas";

// Map the engine's logical colour names to the site's brand tokens (resolved
// from CSS custom properties at runtime, so light/dark themes just work). `ink`
// is the neutral identity colour for the 4th (amoeba) ring.
const COLOR_VARS: Record<string, string> = {
  orange: "--orange",
  blue: "--blue",
  purple: "--indigo", // the brand's intelligence/indigo-purple
  ink: "--fg", // the connective identity ring (dark on light, light on dark)
};

// Draw a closed, smooth Catmull-Rom curve through the ring's points (in canvas px).
const tracePath = (ctx: CanvasRenderingContext2D, s: SoftRingState, ox: number, oy: number, sc: number) => {
  const n = s.n;
  const X = (i: number) => ox + s.xs[((i % n) + n) % n] * sc;
  const Y = (i: number) => oy + s.ys[((i % n) + n) % n] * sc;
  ctx.beginPath();
  ctx.moveTo((X(-1) + 4 * X(0) + X(1)) / 6, (Y(-1) + 4 * Y(0) + Y(1)) / 6);
  for (let i = 0; i < n; i++) {
    const p1x = X(i);
    const p1y = Y(i);
    const p2x = X(i + 1);
    const p2y = Y(i + 1);
    const p0x = X(i - 1);
    const p0y = Y(i - 1);
    const p3x = X(i + 2);
    const p3y = Y(i + 2);
    // Catmull-Rom → cubic bezier control points (uniform, tension 1/6)
    const c1x = p1x + (p2x - p0x) / 6;
    const c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6;
    const c2y = p2y - (p3y - p1y) / 6;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2x, p2y);
  }
  ctx.closePath();
};

export default function SoftRingsField({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();

    // Resolve brand colours from the live theme.
    const cs = getComputedStyle(wrap);
    let palette: Record<string, string> = {};
    const resolvePalette = () => {
      const p: Record<string, string> = {};
      for (const k in COLOR_VARS) p[k] = cs.getPropertyValue(COLOR_VARS[k]).trim() || "#888888";
      palette = p;
    };
    resolvePalette();

    let sc = 1; // virtual-units → device px
    let ox = 0;
    let oy = 0;
    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = sizeCanvas(canvas, w, h);
      const pad = 0.99; // fit the SIZE×SIZE world into the canvas (margin for the wire)
      sc = (Math.min(w, h) / SIZE) * pad * dpr;
      ox = (w * dpr - SIZE * sc) / 2;
      oy = (h * dpr - SIZE * sc) / 2;
    };

    // Draw a position snapshot (array of {color,xs,ys,n}) — light work, stays on main.
    const render = (rings: SoftRingState[]) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = WIRE * sc;
      for (const s of rings) {
        tracePath(ctx, s, ox, oy, sc);
        ctx.strokeStyle = palette[s.color] || "#888888";
        ctx.stroke();
      }
    };

    layout();

    // ── Primary: physics in a Web Worker (off the main thread) ────────────────
    // The worker steps the SoftBodyWorld and posts position snapshots; here we
    // just render the latest one on rAF (cheap). Both are gated on visibility, so
    // nothing runs during the hero entrance or while scrolled away.
    const startWorker = (): (() => void) => {
      let worker: Worker | null = null;
      let frame: SoftRingState[] | null = null;
      let dirty = false; // a new physics frame arrived since the last draw
      let raf = 0;
      let rendering = false;
      let shown = false;
      // Created LAZILY — only when the section nears view — so the worker-chunk
      // compile never runs during the hero entrance (that was the residual stutter).
      const ensureWorker = () => {
        if (worker) return;
        worker = new Worker(new URL("./softBodyWorker.ts", import.meta.url), { type: "module" });
        worker.postMessage({ type: "config", reduced, seed: 7 });
        worker.onmessage = (e: MessageEvent) => {
          if (e.data?.type === "frame") {
            frame = e.data.rings as SoftRingState[];
            dirty = true;
            if (reduced && shown) render(frame); // reduced: one static frame, no loop
          }
        };
      };
      const renderLoop = () => {
        if (!rendering) return;
        // only redraw when the worker produced a new frame (skips redundant draws on
        // high-refresh displays, where rAF outpaces the 60Hz physics)
        if (frame && dirty) {
          render(frame);
          dirty = false;
        }
        raf = requestAnimationFrame(renderLoop);
      };
      // Run ONLY when actually on screen AND the tab is visible. The worker is
      // idle until the first "start", so the physics never runs before the user
      // scrolls to it; "stop" halts the worker loop (not just the rendering).
      let active = false; // currently told to run
      let inView = false;
      let tabVisible = typeof document === "undefined" || !document.hidden;
      const sync = () => {
        const run = inView && tabVisible;
        if (run === active) return; // only toggle on real changes (no message spam)
        active = run;
        if (run) {
          shown = true;
          ensureWorker();
          worker!.postMessage({ type: "start" });
          if (!reduced && !rendering) {
            rendering = true;
            raf = requestAnimationFrame(renderLoop);
          }
        } else {
          worker?.postMessage({ type: "stop" }); // pause the physics in the worker
          rendering = false;
          if (raf) cancelAnimationFrame(raf); // pause rendering on main
          raf = 0;
        }
      };
      const io = new IntersectionObserver(
        ([e]) => {
          inView = e.isIntersecting;
          sync();
        },
        { threshold: 0, rootMargin: "0px" }, // only when truly in view ⇒ never runs during the hero
      );
      io.observe(wrap);
      const onVis = () => {
        tabVisible = !document.hidden;
        sync();
      };
      document.addEventListener("visibilitychange", onVis);
      const ro = new ResizeObserver(() => {
        layout();
        if (frame && shown) render(frame);
      });
      ro.observe(wrap);
      const onScheme = () => {
        resolvePalette();
        if (frame && shown) render(frame);
      };
      const stopScheme = watchColorScheme(onScheme);
      return () => {
        active = false;
        rendering = false;
        if (raf) cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        stopScheme();
        worker?.terminate();
      };
    };

    // ── Fallback: everything on the main thread (no Worker support) ───────────
    const startMainThread = (): (() => void) => {
      const world = new SoftBodyWorld(7);
      let raf = 0;
      let last = 0;
      let running = false;
      let warmed = false;
      let shown = false;
      const frame = (t: number) => {
        if (!running) return;
        const dt = last ? (t - last) / 1000 : 1 / 60;
        last = t;
        world.step(dt);
        render(world.snapshot());
        raf = requestAnimationFrame(frame);
      };
      const start = () => {
        shown = true;
        if (reduced) {
          if (!warmed) {
            world.warm(1.4);
            warmed = true;
          }
          render(world.snapshot());
          return;
        }
        if (running) return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };
      // Gate on in-view AND tab-visible (same as the worker path).
      let inView = false;
      let tabVisible = typeof document === "undefined" || !document.hidden;
      let active = false;
      const sync = () => {
        const run = inView && tabVisible;
        if (run === active) return;
        active = run;
        if (run) start();
        else stop();
      };
      const io =
        typeof IntersectionObserver !== "undefined"
          ? new IntersectionObserver(
              ([e]) => {
                inView = e.isIntersecting;
                sync();
              },
              { threshold: 0 },
            )
          : null;
      let onVis: (() => void) | null = null;
      if (io) {
        io.observe(wrap);
        onVis = () => {
          tabVisible = !document.hidden;
          sync();
        };
        document.addEventListener("visibilitychange", onVis);
      } else {
        start(); // no IntersectionObserver ⇒ can't gate; just run
      }
      const ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              layout();
              if (shown) render(world.snapshot());
            })
          : null;
      ro?.observe(wrap);
      return () => {
        stop();
        io?.disconnect();
        if (onVis) document.removeEventListener("visibilitychange", onVis);
        ro?.disconnect();
      };
    };

    let cleanup: () => void;
    if (typeof Worker !== "undefined" && typeof IntersectionObserver !== "undefined") {
      try {
        cleanup = startWorker();
      } catch {
        cleanup = startMainThread(); // worker construction failed ⇒ run on main
      }
    } else {
      cleanup = startMainThread();
    }
    return () => cleanup();
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true" style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
