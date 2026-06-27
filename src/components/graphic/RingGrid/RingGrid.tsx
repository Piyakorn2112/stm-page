"use client";

/**
 * RingGrid — a pannable field of real STM rings you browse to pick a seed. Two layouts:
 *
 *  • "cover" (default) — an Apple-Watch spherical-fisheye HONEYCOMB filling its box. Pan in
 *    any direction over an unbounded integer lattice (so any seed is reachable). Tap a ring
 *    to select it + snap it to the centre.
 *  • "reel" — a single horizontal ROW: a tactile carousel. Swipe left/right with momentum;
 *    the CENTRED ring is biggest and LIVE-selected (drives the caller as you scrub); it
 *    settles snapped to a ring. A compact colour/ring selector to sit beneath a hero.
 *
 * Each cell is the REAL ring (full charge colour, `exportThumbnailSVG`) rasterised once
 * OFF THE MAIN THREAD (`createImageBitmap`), concurrency-limited + LRU-cached, so a frame is
 * just a few `drawImage`s. The rAF loop runs ONLY while moving; at rest the canvas is static
 * (~0 cost). This is what keeps panning silky with no decode stutter.
 */

import { useEffect, useRef } from "react";
import { exportThumbnailSVG, DARK_BASE } from "@stm-ring";

type Layout = "cover" | "reel" | "orb";

type Props = {
  seedFor: (col: number, row: number) => string;
  colorFor: (seed: string) => string;
  selectedSeed?: string;
  onSelect: (seed: string) => void;
  className?: string;
  /** "cover" — honeycomb fisheye filling the box (default). "reel" — a single horizontal
   *  carousel. "orb" — a self-contained SPHERE whose limb fits INSIDE the box: rings shrink to
   *  nothing at the round edge (no container clipping) and a strong size falloff pops the
   *  centre. A small Apple-Watch ball you tap to pick. */
  layout?: Layout;
};

// honeycomb + fisheye constants (CSS px / sphere math from the hero StructureGrid)
const CORNER_SCALE = 0.28; // rim rings shrink to ~28% ⇒ a deep fisheye
const EDGE_PHI = Math.acos(CORNER_SCALE);
const SPRITE_CAP = 420;
const GRID_SEG = 112; // ring detail for the small grid sprites (they're tiny — keep it cheap)
const GRID_PIECES = 36;
const MAX_INFLIGHT = 6; // concurrent sprite rasterisations (keeps the main thread free)
const DARK_RING_BASE = ["#E7EBFC", "#ABB1D4"]; // light wire base so rings read on a dark page

// cover honeycomb — large rings, deep falloff so the centre pops
const COVER_PITCH = 156;
const COVER_RING = 134;
const COVER_GAMMA = 2.4;
// orb — a self-contained SPHERE (limb fits the box). Small rings + a STRONG falloff (gamma) ⇒
// a big centre ring with a halo shrinking to NOTHING at the round limb (so it never clips the
// container, unlike "cover" which bulges past the rect).
const ORB_RING = 72;
const ORB_PITCH = 66;
const ORB_GAMMA = 2.8; // cranked size difference — the centre pops hard, the rim vanishes
const ORB_LIMB_FRAC = 0.92; // limb radius as a fraction of min(cx,cy) — sits INSIDE the box
const ORB_PHI_CAP = 0.985; // stop a hair short of the pole (avoid the singular crowd)
// reel carousel — smaller rings, tighter pitch, GENTLER falloff so ~5–7 rings stay in view
const REEL_PITCH = 118;
const REEL_RING = 98;
const REEL_GAMMA = 1.5;

export default function RingGrid({
  seedFor,
  colorFor,
  selectedSeed,
  onSelect,
  className,
  layout = "cover",
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // live props for the imperative loop — kept fresh in an effect (not during render)
  const onSel = useRef(onSelect);
  const seedRef = useRef(seedFor);
  const colorRef = useRef(colorFor);
  const selRef = useRef(selectedSeed);
  const layoutRef = useRef(layout);
  useEffect(() => {
    onSel.current = onSelect;
    seedRef.current = seedFor;
    colorRef.current = colorFor;
    selRef.current = selectedSeed;
    layoutRef.current = layout;
  });

  useEffect(() => {
    const cv = canvas.current!;
    const host = wrap.current!;
    const ctx = cv.getContext("2d")!;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let cssW = 0;
    let cssH = 0;

    // captured on mount (layout is a static structural choice — never toggles for a tool)
    const REEL = layoutRef.current === "reel";
    const ORB = layoutRef.current === "orb";
    const PITCH = REEL ? REEL_PITCH : ORB ? ORB_PITCH : COVER_PITCH;
    const ROW_P = PITCH * 0.866;
    const RING = REEL ? REEL_RING : ORB ? ORB_RING : COVER_RING;
    const GAMMA = REEL ? REEL_GAMMA : ORB ? ORB_GAMMA : COVER_GAMMA;

    // focus point over the lattice + velocity (flat px). reel + orb rest ON a ring (col 0 /
    // row 0) so one ring sits dominant in the centre; cover rests between rings.
    let fx = REEL || ORB ? 0 : PITCH * 0.5;
    let fy = REEL || ORB ? 0 : ROW_P * 0.5;
    let vx = 0;
    let vy = 0;
    // snap-to-centre target
    let snap: { x: number; y: number } | null = null;
    // reel: last live-selected centre column (dedupes onSelect while scrubbing)
    let reelCol = NaN;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
    let dark = darkMq.matches;

    // ── sprite cache: the REAL ring (full charge colour), rasterised once per seed
    //    OFF THE MAIN THREAD (createImageBitmap), concurrency-limited so it never
    //    bursts, LRU-capped. This is what keeps panning silky with no decode stutter.
    type Sprite = ImageBitmap | HTMLCanvasElement;
    const sprites = new Map<string, Sprite>();
    const pending = new Set<string>();
    const queue: string[] = [];
    let inflight = 0;
    let gen = 0; // bumps on theme/size change → stale in-flight rasters are discarded

    function ringSVG(seed: string, size: number): string {
      let svg = exportThumbnailSVG(seed, size, false, GRID_SEG, GRID_PIECES);
      if (dark) {
        // recolour the dark base ramp to a light one so the wire reads on a dark page
        svg = svg.split(DARK_BASE[0]).join(DARK_RING_BASE[0]).split(DARK_BASE[1]).join(DARK_RING_BASE[1]);
      }
      return svg;
    }
    async function rasterise(seed: string): Promise<Sprite | null> {
      const size = Math.max(48, Math.round(RING * dpr));
      const blob = new Blob([ringSVG(seed, size)], { type: "image/svg+xml" });
      try {
        return await createImageBitmap(blob); // decoded off the main thread
      } catch {
        // Safari < 16.4 etc.: fall back to <img> → canvas
        return await new Promise<Sprite | null>((res) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = c.height = size;
            c.getContext("2d")!.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(url);
            res(c);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            res(null);
          };
          img.src = url;
        });
      }
    }
    function pump() {
      while (inflight < MAX_INFLIGHT && queue.length) {
        const seed = queue.shift()!;
        if (sprites.has(seed)) {
          pending.delete(seed);
          continue;
        }
        inflight++;
        const myGen = gen;
        rasterise(seed).then((sp) => {
          inflight--;
          pending.delete(seed);
          if (sp && myGen === gen) {
            sprites.set(seed, sp);
            if (sprites.size > SPRITE_CAP) {
              const first = sprites.keys().next().value;
              if (first !== undefined) {
                const old = sprites.get(first);
                if (old instanceof ImageBitmap) old.close();
                sprites.delete(first);
              }
            }
            scheduleDraw();
          } else if (sp instanceof ImageBitmap) {
            sp.close(); // stale (theme/size changed) — discard
          }
          pump();
        });
      }
    }
    function requestSprite(seed: string) {
      if (pending.has(seed) || sprites.has(seed) || queue.length > 90) return;
      pending.add(seed);
      queue.push(seed);
      pump();
    }
    function getSprite(seed: string): Sprite | null {
      const hit = sprites.get(seed);
      if (hit) return hit;
      requestSprite(seed);
      return null;
    }
    function clearSprites() {
      gen++; // invalidate in-flight rasters
      for (const s of sprites.values()) if (s instanceof ImageBitmap) s.close();
      sprites.clear();
      pending.clear();
      queue.length = 0;
    }

    // sphere geometry — the projection radius + the lattice cull radius + max polar angle.
    // cover/reel: the sphere is sized off the CORNER so it bulges past the rect (rim rings ~28%).
    // orb: the sphere LIMB sits inside the box (min half-dim) so rings shrink to ~0 at the round
    // edge ⇒ a self-contained ball that never clips the container.
    function geom() {
      const cx = cssW / 2;
      const cy = cssH / 2;
      if (ORB) {
        const sphereR = Math.min(cx, cy) * ORB_LIMB_FRAC;
        const maxPhi = (Math.PI / 2) * ORB_PHI_CAP;
        return { cx, cy, sphereR, flatMax: sphereR * maxPhi, maxPhi };
      }
      const cornerD = Math.hypot(cx, cy) + RING * 0.5;
      const sphereR = cornerD / Math.sin(EDGE_PHI);
      return { cx, cy, sphereR, flatMax: sphereR * EDGE_PHI, maxPhi: Math.PI / 2 };
    }

    // prefetch a ring of cells just beyond the visible limb so panning reveals cached art
    function prefetch() {
      const flatMax = geom().flatMax * 1.4;
      let budget = 30;
      const rowMin = REEL ? 0 : Math.floor((fy - flatMax) / ROW_P);
      const rowMax = REEL ? 0 : Math.ceil((fy + flatMax) / ROW_P);
      for (let row = rowMin; row <= rowMax && budget > 0; row++) {
        const stagger = !REEL && ((row % 2) + 2) % 2 === 1 ? PITCH / 2 : 0;
        const colMin = Math.floor((fx - flatMax - stagger) / PITCH);
        const colMax = Math.ceil((fx + flatMax - stagger) / PITCH);
        for (let col = colMin; col <= colMax && budget > 0; col++) {
          const dx = col * PITCH + stagger - fx;
          const dy = row * ROW_P - fy;
          if (Math.hypot(dx, dy) > flatMax) continue;
          const seed = seedRef.current(col, row);
          if (!sprites.has(seed) && !pending.has(seed)) {
            requestSprite(seed);
            budget--;
          }
        }
      }
    }

    // ── one frame ─────────────────────────────────────────────────────────────
    function visibleCells(): { col: number; row: number; sx: number; sy: number; scale: number; r: number }[] {
      const { cx, cy, sphereR, flatMax, maxPhi } = geom();
      const out: { col: number; row: number; sx: number; sy: number; scale: number; r: number }[] = [];
      const rowMin = REEL ? 0 : Math.floor((fy - flatMax) / ROW_P) - 1;
      const rowMax = REEL ? 0 : Math.ceil((fy + flatMax) / ROW_P) + 1;
      for (let row = rowMin; row <= rowMax; row++) {
        const stagger = !REEL && ((row % 2) + 2) % 2 === 1 ? PITCH / 2 : 0;
        const colMin = Math.floor((fx - flatMax - stagger) / PITCH) - 1;
        const colMax = Math.ceil((fx + flatMax - stagger) / PITCH) + 1;
        for (let col = colMin; col <= colMax; col++) {
          const flatX = col * PITCH + stagger;
          const flatY = row * ROW_P;
          const dx = flatX - fx;
          const dy = flatY - fy;
          const r = Math.hypot(dx, dy);
          if (r > flatMax) continue;
          const phi = r / sphereR;
          if (phi >= maxPhi) continue;
          const proj = sphereR * Math.sin(phi);
          const scale = Math.cos(phi) ** GAMMA;
          const ang = r < 1e-4 ? 0 : Math.atan2(dy, dx);
          out.push({ col, row, sx: cx + proj * Math.cos(ang), sy: cy + proj * Math.sin(ang), scale, r });
        }
      }
      // paint far → near so the focused centre ring sits on top
      out.sort((a, b) => b.r - a.r);
      return out;
    }

    // reel: live-select the centred ring as the carousel moves (deduped by column)
    function reelSync() {
      if (!REEL) return;
      const col = Math.round(fx / PITCH);
      if (col !== reelCol) {
        reelCol = col;
        onSel.current(seedRef.current(col, 0));
      }
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const cells = visibleCells();
      let focus = cells[cells.length - 1]; // smallest r = nearest centre
      for (const c of cells) if (c.r < (focus?.r ?? Infinity)) focus = c;
      for (const c of cells) {
        const seed = seedRef.current(c.col, c.row);
        const d = RING * c.scale;
        const isFocus = c === focus;
        const isSel = selRef.current !== undefined && seed === selRef.current;
        if (isFocus || isSel) {
          ctx.beginPath();
          ctx.arc(c.sx, c.sy, d * 0.62, 0, Math.PI * 2);
          ctx.fillStyle = colorRef.current(seed);
          ctx.globalAlpha = isSel ? 0.16 : 0.08;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        const sp = getSprite(seed);
        if (sp) {
          ctx.globalAlpha = Math.min(1, 0.45 + c.scale * 0.8);
          ctx.drawImage(sp, c.sx - d / 2, c.sy - d / 2, d, d);
          ctx.globalAlpha = 1;
        }
      }
      reelSync(); // keep the card in step with the centred ring
      prefetch(); // warm the cache just beyond the edges so panning stays cached
    }

    // ── animation loop (runs only while moving) ───────────────────────────────
    let raf = 0;
    let last = 0;
    let drawScheduled = false;
    // one-shot repaint when a sprite finishes loading while the grid is idle
    function scheduleDraw() {
      if (raf || drawScheduled) return;
      drawScheduled = true;
      requestAnimationFrame(() => {
        drawScheduled = false;
        draw();
      });
    }
    function tick(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let moving = false;
      if (!dragging) {
        if (snap) {
          fx += (snap.x - fx) * Math.min(1, dt * 9);
          fy += (snap.y - fy) * Math.min(1, dt * 9);
          if (Math.hypot(snap.x - fx, snap.y - fy) < 0.4) {
            fx = snap.x;
            fy = snap.y;
            snap = null;
          } else moving = true;
        } else if (Math.hypot(vx, vy) > 2) {
          fx -= vx * dt;
          fy -= vy * dt;
          const k = Math.pow(0.9, dt * 60);
          vx *= k;
          vy *= k;
          moving = true;
        } else if (REEL) {
          // momentum spent → settle snapped to the nearest ring (always rest centred)
          const tx = Math.round(fx / PITCH) * PITCH;
          if (Math.abs(tx - fx) > 0.4) {
            snap = { x: tx, y: 0 };
            moving = true;
          }
        }
      } else moving = true;
      draw();
      if (moving) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        last = 0;
      }
    }
    function kick() {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    }

    // ── pointer: drag-pan + tap-select ────────────────────────────────────────
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;
    let downT = 0;
    let moved = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      downT = performance.now();
      moved = 0;
      vx = vy = 0;
      snap = null;
      cv.setPointerCapture(e.pointerId);
      kick();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.hypot(dx, dy);
      fx -= dx;
      if (!REEL) fy -= dy; // reel pans horizontally only
      const dt = 1 / 60;
      vx = vx * 0.6 + (dx / dt) * 0.4;
      vy = REEL ? 0 : vy * 0.6 + (dy / dt) * 0.4;
      draw();
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch {}
      const quick = performance.now() - downT < 400;
      if (moved < 7 && quick) {
        // TAP → select nearest ring, snap it to centre
        const rect = cv.getBoundingClientRect();
        const tx = downX - rect.left;
        const ty = downY - rect.top;
        const cells = visibleCells();
        let best = cells[0];
        let bestD = Infinity;
        for (const c of cells) {
          const dd = Math.hypot(c.sx - tx, c.sy - ty);
          if (dd < bestD) {
            bestD = dd;
            best = c;
          }
        }
        if (best) {
          const stagger = !REEL && ((best.row % 2) + 2) % 2 === 1 ? PITCH / 2 : 0;
          snap = { x: best.col * PITCH + stagger, y: REEL ? 0 : best.row * ROW_P };
          onSel.current(seedRef.current(best.col, best.row));
        }
      } else {
        const cap = 2600;
        const sp = Math.hypot(vx, vy);
        if (sp > cap) {
          vx = (vx / sp) * cap;
          vy = (vy / sp) * cap;
        }
        if (reduce) {
          vx = vy = 0;
        }
      }
      kick();
    };

    // ── sizing + lifecycle ────────────────────────────────────────────────────
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = host.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      cv.style.width = `${cssW}px`;
      cv.style.height = `${cssH}px`;
      clearSprites(); // dpr/size may have changed → re-rasterise
      draw();
    };
    const onDark = () => {
      dark = darkMq.matches;
      clearSprites();
      scheduleDraw();
    };
    darkMq.addEventListener("change", onDark);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      darkMq.removeEventListener("change", onDark);
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={wrap} className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* reel pans horizontally only → let vertical swipes scroll the page (pan-y) */}
      <canvas
        ref={canvas}
        style={{ display: "block", touchAction: layout === "reel" ? "pan-y" : "none", cursor: "grab" }}
      />
    </div>
  );
}
