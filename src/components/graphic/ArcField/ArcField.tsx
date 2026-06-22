"use client";

/**
 * ArcField — the Philosophy graphic ("Structure for what's next"). A stiff black
 * soft-body RING breathes in the open part of the section; Lucide product icons
 * continuously EMERGE from it, grow, drift in a bounded cloud, AGE (shrinking until
 * gone) and re-emit — a never-resting living loop. The physics runs OFF the main
 * thread (`arcFieldWorker.ts` + `arcEngine.ts`); here we stroke the ring to <canvas>
 * and drive the DOM icon transforms from the worker's snapshots.
 *
 * It fills the WHOLE section (full-bleed). The container size is sent to the worker
 * live on resize (no reset), and the text's rectangle is sent as a reserve so icons
 * never slide under the copy. Same pause discipline as the lava lamp.
 */

import { useEffect, useRef } from "react";
import {
  MessageCircle, MessageSquare, FileText, PenTool, Pencil, Palette, Lightbulb, Image, Feather, Type, Music, StickyNote,
  Camera, Video, Mic, Scissors, Bookmark, Calendar, Folder, Mail, Heart, Star, Code, Sparkles, Film, Aperture, Headphones, Layout,
} from "lucide-react";
import { ARC_N, ICON_R } from "./arcEngine";
import { prefersReducedMotion, watchColorScheme } from "@/utils/media";
import { sizeCanvas } from "@/utils/canvas";

const ICONS = [
  MessageCircle, FileText, PenTool, Palette, Lightbulb, Pencil, Image, Feather, Type, Music, MessageSquare, StickyNote,
  Camera, Video, Mic, Scissors, Bookmark, Calendar, Folder, Mail, Heart, Star, Code, Sparkles, Film, Aperture, Headphones, Layout,
];
const GLYPH = 0.95; // glyph diameter ÷ hitbox diameter (a bit larger on full grown)
const RESERVE_PAD = 14; // px clearance kept around the text rect

type Snap = { ring: Float64Array; rc: number; cx: Float64Array; cy: Float64Array; rot: Float64Array; scale: Float64Array };

export default function ArcField({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const cs = getComputedStyle(wrap);
    const ink = () => cs.getPropertyValue("--fg").trim() || "#0a0a0b";

    let w = 1;
    let h = 1;
    let frame: Snap | null = null;

    // text reserve rect + the content container's right edge (so the ring sits in the
    // container's right region — same ring↔text distance as the lava-lamp section).
    let focusR = 0;
    const reserve = () => {
      const root = wrap.closest("section") ?? document;
      const el = root.querySelector("[data-arc-reserve]");
      const wr = wrap.getBoundingClientRect();
      focusR = wr.width;
      if (!el) return null;
      const cont = el.parentElement; // the .container that bounds the copy column
      if (cont) focusR = cont.getBoundingClientRect().right - wr.left;
      const r = el.getBoundingClientRect();
      const x = r.left - wr.left - RESERVE_PAD;
      const y = r.top - wr.top - RESERVE_PAD;
      const rw = r.width + RESERVE_PAD * 2;
      const rh = r.height + RESERVE_PAD * 2;
      // ignore the text rect when it isn't actually over the canvas (mobile = text
      // is stacked BELOW the canvas) ⇒ the ring centres in the canvas instead.
      if (x >= wr.width || x + rw <= 0 || y >= wr.height || y + rh <= 0) return null;
      return { x, y, w: rw, h: rh };
    };

    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = sizeCanvas(canvas, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // engine is already in CSS px ⇒ 1:1
    };

    const render = () => {
      if (!frame) return;
      const ring = frame.ring;
      const C = ring.length / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = frame.rc * 0.3; // wire gauge tracks the (tier-scaled) ring radius
      ctx.strokeStyle = ink();
      const X = (i: number) => ring[(((i % C) + C) % C) * 2];
      const Y = (i: number) => ring[(((i % C) + C) % C) * 2 + 1];
      ctx.beginPath();
      ctx.moveTo((X(-1) + 4 * X(0) + X(1)) / 6, (Y(-1) + 4 * Y(0) + Y(1)) / 6);
      for (let i = 0; i < C; i++) {
        const c1x = X(i) + (X(i + 1) - X(i - 1)) / 6;
        const c1y = Y(i) + (Y(i + 1) - Y(i - 1)) / 6;
        const c2x = X(i + 1) - (X(i + 2) - X(i)) / 6;
        const c2y = Y(i + 1) - (Y(i + 2) - Y(i)) / 6;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, X(i + 1), Y(i + 1));
      }
      ctx.closePath();
      ctx.stroke();
    };

    const updateIcons = () => {
      if (!frame) return;
      const ring = frame.ring;
      const C = ring.length / 2;
      let rcx = 0;
      let rcy = 0;
      for (let i = 0; i < C; i++) {
        rcx += ring[i * 2];
        rcy += ring[i * 2 + 1];
      }
      rcx /= C;
      rcy /= C;
      const base = ICON_R * 2 * GLYPH;
      for (let i = 0; i < ARC_N; i++) {
        const el = iconRefs.current[i];
        if (!el) continue;
        const scl = frame.scale[i];
        const cx = frame.cx[i];
        const cy = frame.cy[i];
        // invisible while inside the ring: fade in as the centre crosses out past it
        let crossF = (Math.hypot(cx - rcx, cy - rcy) - frame.rc) / ICON_R;
        crossF = crossF < 0 ? 0 : crossF > 1 ? 1 : crossF;
        const op = scl * crossF;
        if (op <= 0.01) {
          el.style.opacity = "0";
          continue;
        }
        const s = base * scl;
        el.style.width = `${s}px`;
        el.style.height = `${s}px`;
        el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) rotate(${frame.rot[i]}rad)`;
        el.style.opacity = `${op}`;
      }
    };

    layout();

    let worker: Worker | null = null;
    let raf = 0;
    let rendering = false;
    let active = false;
    let inView = false;
    let tabVisible = typeof document === "undefined" || !document.hidden;
    const pushSize = () => {
      const res = reserve(); // also updates focusR
      worker?.postMessage({ type: "resize", w, h, res, focusR });
    };
    const ensureWorker = () => {
      if (worker) return;
      worker = new Worker(new URL("./arcFieldWorker.ts", import.meta.url), { type: "module" });
      worker.postMessage({ type: "config", reduced, seed: 5 });
      pushSize();
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "frame") {
          frame = e.data as Snap;
          if (reduced) {
            render();
            updateIcons();
          }
        }
      };
    };
    const renderLoop = () => {
      if (!rendering) return;
      render();
      updateIcons();
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
      pushSize();
      render();
      updateIcons();
    });
    ro.observe(wrap);
    const onScheme = () => render();
    const stopScheme = watchColorScheme(onScheme);
    // RESET only when the layout breakpoint (mobile) flips — plain resizes stay live.
    const bp = window.matchMedia("(max-width: 880px)");
    const onBp = () => {
      worker?.postMessage({ type: "reset" });
      pushSize();
      if (active) worker?.postMessage({ type: "start" }); // restart fresh (reduced re-warms)
    };
    bp.addEventListener?.("change", onBp);

    return () => {
      rendering = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stopScheme();
      bp.removeEventListener?.("change", onBp);
      worker?.terminate();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true" style={{ width: "100%", height: "100%", color: "var(--fg)" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      {Array.from({ length: ARC_N }, (_, i) => {
        const Icon = ICONS[i % ICONS.length];
        return (
          <span
            key={i}
            ref={(el) => {
              iconRefs.current[i] = el;
            }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transformOrigin: "center",
              display: "grid",
              placeItems: "center",
              opacity: 0,
              pointerEvents: "none",
              willChange: "transform, opacity",
            }}
          >
            <Icon style={{ width: "100%", height: "100%" }} strokeWidth={2} absoluteStrokeWidth />
          </span>
        );
      })}
    </div>
  );
}
