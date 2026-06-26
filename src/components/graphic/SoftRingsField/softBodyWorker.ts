/**
 * softBodyWorker — runs the lava-lamp PHYSICS off the main thread. It owns the
 * SoftBodyWorld and steps it on its own timer, posting a lightweight position
 * snapshot back each tick; the main thread just strokes those positions to the
 * canvas (cheap). Workers have no requestAnimationFrame, so we self-drive with
 * setTimeout (~60fps); dt is clamped inside the engine. Started/stopped on
 * visibility by the main thread, so it does nothing while off-screen.
 *
 * No DOM here — the engine is pure math, worker-safe.
 */

import { SoftBodyWorld } from "./softBody";

let world = new SoftBodyWorld(7);
let running = false;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
let lastT = 0;
let reduced = false;
let warmed = false;

const post = () => {
  // snapshot() returns the engine's live Float64Arrays; structured-clone copies
  // them on postMessage (originals stay intact for the next step).
  const snap = world.snapshot();
  (self as unknown as Worker).postMessage({
    type: "frame",
    rings: snap.map((s) => ({ color: s.color, xs: s.xs, ys: s.ys, n: s.n })),
  });
};

const loop = () => {
  if (!running) return;
  const now = performance.now();
  const dt = lastT ? (now - lastT) / 1000 : 1 / 60;
  lastT = now;
  world.step(dt);
  post();
  timer = setTimeout(loop, 1000 / 60);
};

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "config") {
    reduced = !!m.reduced;
    if (typeof m.seed === "number") world = new SoftBodyWorld(m.seed);
  } else if (m.type === "start") {
    if (reduced) {
      if (!warmed) {
        world.warm(1.4);
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
