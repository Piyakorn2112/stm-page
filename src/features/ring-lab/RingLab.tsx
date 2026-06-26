"use client";

/**
 * /ring-lab — EXPERIMENT harness comparing the current SVG hero animation
 * against the new Canvas "Still Water" reveal (HeroTwistRing).
 *
 * One shared reveal loop (bloom → hold → relax, repeating) drives BOTH rings in
 * sync, so you can compare:
 *   • SMOOTHNESS — the SVG side runs the current exp-spring + coupled spin; the
 *     Canvas side runs a fixed-duration decoupled tween with a lagged charge.
 *   • PERF — the FPS meter + the mode toggle (Both / SVG only / Canvas only) let
 *     you see each renderer's cost in isolation. Watch FPS while only one is on.
 *   • FIDELITY — does the Canvas ring LOOK like the SVG one? (same core geometry)
 *
 * Throwaway page; nothing else imports it. The live hero is untouched.
 */

import { useEffect, useRef, useState } from "react";
import { StmRing, randomSeed } from "@stm-ring";
import HeroTwistRing from "@/components/graphic/HeroStructure/HeroTwistRing";
import { useStructureTheme } from "@/utils/structureTheme";

const SIZE = 460;
const SEGMENTS = 560;
const PIECES = 240;
// Reveal loop timing.
const HOLD_MS = 2600; // bloom + dwell on the shape
const REST_MS = 1500; // back at the rest circle before the next bloom

type Mode = "both" | "svg" | "canvas";

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let t0 = performance.now();
    const loop = (t: number) => {
      frames++;
      if (t - t0 >= 500) {
        setFps(Math.round((frames * 1000) / (t - t0)));
        frames = 0;
        t0 = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

export default function RingLab() {
  const theme = useStructureTheme();
  const [seed, setSeed] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("both");
  const fps = useFps();
  const timers = useRef<number[]>([]);

  // The shared reveal loop.
  useEffect(() => {
    const clearAll = () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
    };
    const cycle = () => {
      setSeed(String(randomSeed()));
      timers.current.push(
        window.setTimeout(() => {
          setSeed(null);
          timers.current.push(window.setTimeout(cycle, REST_MS));
        }, HOLD_MS),
      );
    };
    cycle();
    return clearAll;
  }, []);

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: theme.bg,
    color: theme.subtext,
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 28,
    padding: "40px 24px 80px",
  };
  const cellH = (SIZE * 171) / 176;
  const cell: React.CSSProperties = {
    width: SIZE,
    height: cellH,
    display: "grid",
    placeItems: "center",
  };
  const label: React.CSSProperties = {
    fontSize: 13,
    letterSpacing: "0.02em",
    textAlign: "center",
    marginTop: 10,
    opacity: 0.8,
  };
  const btn = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--blue, #3B86FF)" : theme.dark ? "#333" : "#ddd"}`,
    background: active ? "var(--blue, #3B86FF)" : "transparent",
    color: active ? "#fff" : theme.subtext,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  });

  return (
    <main style={wrap}>
      <header style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: theme.dark ? "#fff" : "#111" }}>
          Hero ring: animation experiment
        </h1>
        <p style={{ fontSize: 14, maxWidth: 560, margin: "10px auto 0", lineHeight: 1.5 }}>
          Same reveal loop drives both. Left = current SVG (exp-spring + coupled spin). Right =
          new Canvas &ldquo;Still Water&rdquo; (fixed-duration decoupled tween, lagged charge).
          Toggle to isolate each renderer and watch the FPS.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
          {(["both", "svg", "canvas"] as Mode[]).map((m) => (
            <button key={m} style={btn(mode === m)} onClick={() => setMode(m)}>
              {m === "both" ? "Both" : m === "svg" ? "SVG only" : "Canvas only"}
            </button>
          ))}
          <span style={{ ...btn(false), borderColor: "transparent", cursor: "default" }}>
            {fps} fps
          </span>
        </div>
      </header>

      <div style={{ display: "flex", gap: 56, flexWrap: "wrap", justifyContent: "center" }}>
        {mode !== "canvas" && (
          <div>
            <div style={cell}>
              <StmRing
                size={SIZE}
                segments={SEGMENTS}
                pieces={PIECES}
                fps={70}
                forceSeed={seed}
                baseColors={theme.ringBase}
                hoverable={false}
              />
            </div>
            <div style={label}>Current: SVG · exp-spring</div>
          </div>
        )}
        {mode !== "svg" && (
          <div>
            <div style={cell}>
              <HeroTwistRing
                seed={seed}
                size={SIZE}
                segments={SEGMENTS}
                pieces={PIECES}
                baseColors={theme.ringBase}
              />
            </div>
            <div style={label}>New: Canvas · &ldquo;Still Water&rdquo;</div>
          </div>
        )}
      </div>
    </main>
  );
}
