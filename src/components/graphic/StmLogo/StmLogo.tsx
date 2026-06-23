"use client";

/**
 * StmLogo — the full Srang Tech Mai brand lockup with the LIVE interactive ring
 * (ported from the stm-ring lab's `StmFullLogo`, which was used on the hero page).
 * The `STM text.svg` wordmark is dropped in 1:1 over the logo layout; the static
 * brand ring is replaced by a live `<StmRing/>` sitting over the exact ring slot.
 * The ring breathes continuously and blooms into a twist on hover.
 *
 * Differences from the lab original:
 *  • LIGHT/DARK — light mode uses the dark wire ring + black wordmark; dark mode uses
 *    the white (opacity) ring variant + an inverted (white) wordmark.
 *  • OPTIMISED + PAUSED OFF-SCREEN — the ring runs an rAF loop even at rest (it
 *    breathes), so we cap its fps, lower its segment/strand detail (a small decorative
 *    ring needs nothing near the full live resolution), and PAUSE it whenever it's out
 *    of view or the tab is hidden (IntersectionObserver + visibilitychange), matching
 *    the pause discipline of the other graphic features. Reduced motion is honoured by
 *    StmRing itself (no loop).
 *
 * Placement constants are the lab original's (derived from the logo's affine transforms).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StmRing } from "@stm-ring";
import styles from "./styles.module.css";

// Subscribe to the OS colour scheme without effect-setState (SSR-safe; server snapshot = light).
const subscribeDark = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const LOGO_AR = 359 / 107; // brand logo aspect ratio
const RING_SIZE_RATIO = 0.374; // StmRing px size as a fraction of logo width
const RING_CX = "15.36%";
const RING_CY = "50.03%";
const TEXT_BOX = { left: "34.52%", top: "10.09%", width: "65.46%", height: "80.37%" } as const;

// A small decorative ring doesn't need the full live detail — far cheaper per frame.
const SEGMENTS = 280; // < N_LIVE 700 (multiple of 4)
const PIECES = 140; // < K_LIVE 360 (multiple of 4)
const FPS = 30; // the breathe/hover is subtle; 30fps is plenty

export default function StmLogo({ width = 300, className }: { width?: number; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dark = useSyncExternalStore(subscribeDark, getDark, () => false);
  const [paused, setPaused] = useState(true); // start paused; the observer wakes it in view

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let inView = false;
    let tabVisible = !document.hidden;
    const sync = () => setPaused(!(inView && tabVisible));
    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(el);
    const onVis = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`${styles.logo} ${className ?? ""}`}
      style={{ width, height: width / LOGO_AR }}
    >
      {/* wordmark — black artwork; inverted to white on dark via CSS */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/STM%20text.svg" alt="Srang Tech Mai" className={styles.wordmark} style={TEXT_BOX} />

      {/* live brand ring over the logo's ring slot (dark wire in light mode, white in dark) */}
      <div className={styles.ring} style={{ left: RING_CX, top: RING_CY }}>
        <StmRing
          size={width * RING_SIZE_RATIO}
          white={dark}
          segments={SEGMENTS}
          pieces={PIECES}
          fps={FPS}
          paused={paused}
        />
      </div>
    </div>
  );
}
