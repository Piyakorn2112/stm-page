/**
 * footerMatrixWorker — runs the footer's faint Game-of-Life ring field entirely OFF
 * the main thread, painting straight onto a transferred OffscreenCanvas. Workers have
 * no rAF, so it self-drives one GENERATION every `genMs` (≈2–3/s — far under any fps
 * cap, and between steps nothing changes so it's nearly free). Started/stopped on
 * visibility by the main thread (paused when off-screen or the tab is hidden).
 * prefers-reduced-motion ⇒ the seeded still frame only, no stepping.
 */

import { FooterMatrixEngine, type FooterMatrixConfig } from "./footerMatrixEngine";

let engine: FooterMatrixEngine | null = null;
let running = false;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
let interval = 420;
let reduced = false;

const loop = () => {
  if (!running || !engine) return;
  engine.step();
  timer = setTimeout(loop, interval);
};

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    const cfg = m.config as Partial<FooterMatrixConfig>;
    engine = new FooterMatrixEngine(m.canvas as OffscreenCanvas, cfg);
    reduced = !!m.reduced;
    interval = cfg?.genMs ?? 420;
    engine.setTheme(!!m.dark);
    engine.setSize(m.w, m.h, m.dpr); // paints the seeded field (the still frame too)
    if (m.reserves) engine.setReserves(m.reserves);
  } else if (m.type === "resize") {
    engine?.setSize(m.w, m.h, m.dpr);
  } else if (m.type === "reserve") {
    engine?.setReserves(m.rects ?? []);
  } else if (m.type === "theme") {
    engine?.setTheme(!!m.dark);
  } else if (m.type === "start") {
    if (reduced || running || !engine) return;
    running = true;
    loop();
  } else if (m.type === "stop") {
    running = false;
    if (timer) clearTimeout(timer);
    timer = 0;
  }
};
