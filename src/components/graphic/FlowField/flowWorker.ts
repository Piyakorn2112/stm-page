/**
 * flowWorker — runs the "Where it takes form" pipeline physics OFF the main thread.
 * Owns a FlowWorld, self-drives with setTimeout, posts a snapshot each tick. Started/
 * stopped on visibility by the main thread. prefers-reduced-motion ⇒ one static frame.
 */

import { FlowWorld } from "./flowEngine";

let seed = 11;
let world = new FlowWorld(seed);
let running = false;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
let lastT = 0;
let reduced = false;
let warmed = false;

const post = () => {
  const s = world.snapshot();
  (self as unknown as Worker).postMessage({
    type: "frame",
    cx: s.cx,
    cy: s.cy,
    rad: s.rad,
    rot: s.rot,
    morph: s.morph,
    seed: s.seed,
    op: s.op,
    hx: s.hx,
    hy: s.hy,
  });
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
    world = new FlowWorld(seed);
  } else if (m.type === "resize") {
    world.config(m.w, m.h);
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
