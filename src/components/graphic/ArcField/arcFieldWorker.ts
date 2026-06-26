/**
 * arcFieldWorker — runs the Philosophy graphic's continuous physics OFF the main
 * thread. Owns an ArcWorld, self-drives with setTimeout (workers have no rAF), and
 * posts a snapshot (ring points + per-slot pose/scale) each tick. Started/stopped on
 * visibility by the main thread (it's a never-resting loop, so it must be paused when
 * off-screen). prefers-reduced-motion ⇒ one static composed frame, no loop.
 */

import { ArcWorld } from "./arcEngine";

let seed = 5;
let world = new ArcWorld(seed);
let running = false;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
let lastT = 0;
let reduced = false;
let warmed = false;

const post = () => {
  const s = world.snapshot();
  (self as unknown as Worker).postMessage({ type: "frame", ring: s.ring, rc: s.rc, cx: s.cx, cy: s.cy, rot: s.rot, scale: s.scale });
};

const loop = () => {
  if (!running) return;
  const now = performance.now();
  const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
  lastT = now;
  world.step(dt);
  post();
  timer = setTimeout(loop, 1000 / 60);
};

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "config") {
    reduced = !!m.reduced;
    if (typeof m.seed === "number") seed = m.seed;
    world = new ArcWorld(seed);
  } else if (m.type === "reset") {
    // breakpoint (mobile layout) change ⇒ rebuild from scratch (next resize configures it)
    world = new ArcWorld(seed);
    warmed = false;
  } else if (m.type === "resize") {
    // live container update from the section size + text rect + content right edge (no reset)
    world.config(m.w, m.h, m.res ?? null, m.focusR);
  } else if (m.type === "start") {
    if (reduced) {
      if (!warmed) {
        world.warm();
        warmed = true;
      }
      post();
      return;
    }
    if (running) return;
    running = true;
    lastT = 0;
    loop();
  } else if (m.type === "stop") {
    running = false;
    if (timer) clearTimeout(timer);
    timer = 0;
  }
};
