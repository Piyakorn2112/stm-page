"use client";

/**
 * FooterMatrix — thin client shell over `footerMatrixEngine`, running the Game-of-Life
 * ring field in a worker on a transferred OffscreenCanvas so the footer backdrop costs
 * the main thread NOTHING. Only steps generations while in view (IntersectionObserver)
 * and the tab is visible — same pause discipline as the other graphic features. Pushes
 * size on resize and theme on colour-scheme change; honours reduced motion (the worker
 * shows the seeded still frame, no stepping). Where OffscreenCanvas isn't supported it
 * gracefully no-ops (the footer keeps its plain soft background).
 *
 * READABILITY: it measures the footer's actual TEXT element rects (links, headings,
 * tagline, note, logo — tight boxes, not a big reserve) and posts them to the worker,
 * which keeps those cells permanently dead. Text then sits on just the barely-there
 * resting lattice, so it stays legible while Life flows around it. Re-measured on
 * resize and once fonts settle (text can shift on load).
 */

import { useEffect, useRef } from "react";
import { prefersReducedMotion, prefersDark, watchColorScheme } from "@/utils/media";
import { DEFAULT_CONFIG } from "./footerMatrixEngine";
import styles from "./styles.module.css";

export default function FooterMatrix({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || !canvas.transferControlToOffscreen) return;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    let w = 1;
    let h = 1;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
    };
    measure();

    // Tight rects of the footer's real text/brand elements, relative to the wrap —
    // so the worker can keep bright rings off the actual glyphs (not a coarse box).
    const footer = wrap.closest("footer");
    const measureReserves = () => {
      if (!footer) return [];
      const o = wrap.getBoundingClientRect();
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      footer.querySelectorAll("a, p, span").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        rects.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
      });
      return rects;
    };

    const offscreen = canvas.transferControlToOffscreen();
    const worker = new Worker(new URL("./footerMatrixWorker.ts", import.meta.url), { type: "module" });
    worker.postMessage(
      {
        type: "init",
        canvas: offscreen,
        w,
        h,
        dpr: dpr(),
        dark: prefersDark(),
        reduced: prefersReducedMotion(),
        config: DEFAULT_CONFIG,
        reserves: measureReserves(),
      },
      [offscreen],
    );
    // text can shift once webfonts load — re-measure then.
    document.fonts?.ready.then(() => worker.postMessage({ type: "reserve", rects: measureReserves() }));

    let inView = false;
    let tabVisible = !document.hidden;
    let active = false;
    const sync = () => {
      const go = inView && tabVisible;
      if (go === active) return;
      active = go;
      worker.postMessage({ type: go ? "start" : "stop" });
    };

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVis = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(() => {
      measure();
      worker.postMessage({ type: "resize", w, h, dpr: dpr() });
      worker.postMessage({ type: "reserve", rects: measureReserves() });
    });
    ro.observe(wrap);

    const stopScheme = watchColorScheme(() => worker.postMessage({ type: "theme", dark: prefersDark() }));

    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stopScheme();
      worker.terminate();
    };
  }, []);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ""}`} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
