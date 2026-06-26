"use client";

/**
 * StructureScene — the client orchestrator for /structure. It owns the entrance
 * choreography and the living idle behaviour, composing the existing pieces
 * (loader → field → hero ring → tagline) without touching the shared core.
 *
 * Phase machine:  loading → entering → live
 *
 *   loading  A backdrop-coloured overlay with a small StmRing in `animate` mode
 *            that blooms in. It holds for MIN_LOADER_MS so it never flashes; the
 *            heavy field mounts BEHIND it (hidden) so its first layout happens
 *            under the loader and the reveal is just cheap CSS transforms.
 *   entering The loader fades out + unmounts. The hero ring blooms a random
 *            colourful "flower" then relaxes to rest; the field springs out from
 *            the centre (grid.bloomIn()).
 *   live     The hero ring morphs into a new shape on its OWN jittered timer
 *            (INTERVAL ONLY — no hover, no ring scaling). While it holds the shape
 *            the field pulls IN + shrinks dramatically and HOLDS (grid.waveTo(true)),
 *            then releases when the ring comes back to the circle (grid.waveTo(false)).
 *
 * prefers-reduced-motion: skip straight to a static look — no loader, no morphs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StmRing, randomSeed } from "@stm-ring";
import StructureGrid, { type StructureGridHandle } from "./StructureGrid";
import StructureHeroRing from "./StructureHeroRing";
import { useStructureTheme, type StructureTheme } from "@/utils/structureTheme";

const FONT = "var(--font-sans), system-ui, sans-serif";

// Fade the field to the backdrop colour toward the bottom, for the tagline.
const bottomFade = (to: string) =>
  `linear-gradient(to bottom, ${to}00 0%, ${to}00 60%, ${to} 90%)`;

// Backdrop: a smooth radial from a slightly lighter centre to a darker edge
// (neutral grey in dark mode). Solid when centre === edge (light mode).
const backdrop = (theme: StructureTheme) =>
  theme.bgCenter !== theme.bg
    ? `radial-gradient(circle at 50% 46%, ${theme.bgCenter} 0%, ${theme.bg} 92%)`
    : theme.bg;

// ── Timing tunables (all ms) ────────────────────────────────────────────────
// The loader is a TRUE precompute gate, not a fixed delay: it holds until BOTH
// MIN_LOADER_MS has passed (no flash) AND the field has finished decoding its
// thumbnails (StructureGrid's onReady) — so the entrance spring is pure
// compositor work and never stutters on first paint. MAX_LOADER_MS caps the
// wait so a slow/odd device can never hang on the loader.
const MIN_LOADER_MS = 1500; // min loader time ⇒ no flash; extra padding so the mark reads
const MAX_LOADER_MS = 5600; // hard cap: enter even if precompute hasn't signalled
const LOADER_FADE_MS = 420; // loader cross-fade out (gentle handoff to the hero)
const LOADER_SIZE = 108; // px — small centred mark
// Entrance keeps its lead: the hero blooms, then a beat later the field springs
// out — a deliberate, sequential reveal (NOT concurrent, by design). The lead is
// generous so the grid starts animating well AFTER the hero ring (the heaviest
// first-paint work), spreading peak load — the grid's OWN wavefront is gentle too
// (StructureGrid SPRING_SPEED). This only delays the entrance; the idle morph
// cadence + reaction wave (the "interval") are unchanged.
const RING_BLOOM_DELAY = 480; // hero bloom → field spring (lead)
// Idle self-morphs: a slightly irregular, RARE cadence so the ring curving into a
// shape feels like an occasional event (avg ~16s). The first comes sooner.
const IDLE_FIRST_MS = 3800;
const IDLE_BASE_MS = 16000;
const IDLE_JITTER_MS = 5000;
// ENTRANCE: how long to keep the colourful shape after the field spring has
// fully played out, before relaxing to the rest ring.
const ACTIVE_DWELL_MS = 1400;
// IDLE: once the field has finished pulling IN (compress wave done), hold the
// shape + compressed field this much longer before the ring comes back.
const HOLD_DWELL_MS = 650;
// The ring starts relaxing a hair before the field releases.
const RELEASE_LEAD_MS = 120;

const EASE_OUT_BACK = "cubic-bezier(0.34, 1.45, 0.64, 1)";

type Phase = "loading" | "entering" | "live";

export default function StructureScene({
  active = true,
  exiting = false,
  onEntered,
}: {
  /** false ⇒ the hero is off-screen / exiting: pause the ring loop, the field's
   *  morph cadence + breathing, and the idle self-morph timer. Default true = no-op. */
  active?: boolean;
  /** true ⇒ play the scripted exit (field collapse + ring shrink). The fade is
   *  done by the parent's container opacity; here we only drive the MOTION. */
  exiting?: boolean;
  /** Fired once the entrance has fully played out (phase → "live"), incl. the
   *  reduced-motion path. The page uses it to defer mounting the rest of the
   *  content until the hero animation is done. */
  onEntered?: () => void;
} = {}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [showLoader, setShowLoader] = useState(true);
  const [loaderIn, setLoaderIn] = useState(false); // loader bloom-in
  const [loaderFading, setLoaderFading] = useState(false);
  const [entered, setEntered] = useState(false); // hero ring bloom
  // The hero's shape = the current interval (or entrance) morph's seed; null =
  // rest. Hover is intentionally NOT wired — the ring is interval-driven only.
  const [heroSeed, setHeroSeed] = useState<string | null>(null);
  // Assume motion is allowed for SSR/first paint; corrected on mount.
  const [motionOK, setMotionOK] = useState(true);
  const theme = useStructureTheme(); // follows OS prefers-color-scheme

  const gridRef = useRef<StructureGridHandle>(null);
  const timers = useRef<Set<number>>(new Set()); // every timer (unmount cleanup)
  // Refs so the long-lived entrance/idle effect reads the LATEST value without
  // re-running (which would restart the whole choreography).
  const activeRef = useRef(active);
  const onEnteredRef = useRef(onEntered);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onEnteredRef.current = onEntered;
  }, [onEntered]);

  // Entrance gating: the loader dismisses (→ entrance) only once the min time has
  // elapsed AND the grid has signalled ready (precompute done). `enteredStartedRef`
  // makes the entrance fire exactly once (whichever of the gate / the MAX cap wins).
  const minElapsedRef = useRef(false);
  const gridReadyRef = useRef(false);
  const enteredStartedRef = useRef(false);

  const after = useCallback((ms: number, fn: () => void): number => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  // One self-morph reaction: the ring morphs to `seed` and the field pulls IN +
  // shrinks CONCURRENTLY (no lead) and HOLDS, then the ring relaxes and the field
  // releases a beat later. Reactions never overlap (the idle gap ≫ a reaction's
  // length), so no cancellation is needed.
  const reactOnce = useCallback(
    (seed: string) => {
      setHeroSeed(seed); // ring goes active (morphs into the shape) …
      // … and the field compresses at the SAME time — no timeout. The wave is
      // compositor work, so it rides alongside the ring's main-thread morph.
      const compMs = gridRef.current?.waveTo(true) ?? 0;
      after(compMs + HOLD_DWELL_MS, () => {
        setHeroSeed(null); // ring relaxes back to rest …
        after(RELEASE_LEAD_MS, () => gridRef.current?.waveTo(false)); // … field releases a beat later
      });
    },
    [after],
  );

  // The rare, irregular self-morph timer; re-arms via a ref (no useCallback self-ref).
  const scheduleIdleRef = useRef<(firstDelay?: number) => void>(() => {});
  const scheduleIdle = useCallback(
    (firstDelay?: number) => {
      const delay = firstDelay ?? IDLE_BASE_MS + (Math.random() * 2 - 1) * IDLE_JITTER_MS;
      after(delay, () => {
        // Skip the morph while the hero is off-screen (no point waving a field
        // nobody can see) but keep the timer re-arming so it resumes when back.
        if (activeRef.current) reactOnce(String(randomSeed()));
        scheduleIdleRef.current();
      });
    },
    [after, reactOnce],
  );
  useEffect(() => {
    scheduleIdleRef.current = scheduleIdle;
  }, [scheduleIdle]);

  // The whole entrance choreography, fired ONCE when the loader is dismissed:
  // fade the loader out, bloom the hero ring + charge it into a flower, spring
  // the field out (concurrently), dwell, then relax to rest and go live.
  const startEntrance = useCallback(() => {
    if (enteredStartedRef.current) return;
    enteredStartedRef.current = true;
    setPhase("entering");
    setLoaderFading(true);
    after(LOADER_FADE_MS, () => setShowLoader(false)); // unmount ⇒ free its rAF + unlock scroll
    setEntered(true);
    setHeroSeed(String(randomSeed()));
    after(RING_BLOOM_DELAY, () => {
      const springMs = gridRef.current?.bloomIn() ?? 0;
      after(springMs + ACTIVE_DWELL_MS, () => {
        setHeroSeed(null);
        setPhase("live");
        scheduleIdle(IDLE_FIRST_MS);
        onEnteredRef.current?.(); // entrance done ⇒ page may mount the rest
      });
    });
  }, [after, scheduleIdle]);

  // Enter as soon as BOTH gates are satisfied (min time + grid ready). Called
  // from the min-time timer and from onReady — never from render — so there is
  // no set-state-in-effect here.
  const maybeEnter = useCallback(() => {
    if (minElapsedRef.current && gridReadyRef.current) startEntrance();
  }, [startEntrance]);

  const onGridReady = useCallback(() => {
    gridReadyRef.current = true;
    maybeEnter();
  }, [maybeEnter]);

  useEffect(() => {
    const pending = timers.current; // stable Set; capture for the cleanup closure
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      enteredStartedRef.current = true; // never run the animated entrance
      setMotionOK(false);
      setShowLoader(false);
      setEntered(true);
      setPhase("live");
      gridRef.current?.reveal();
      onEnteredRef.current?.();
      return;
    }

    // Loader blooms in on the next frame (so the transition runs).
    const raf = requestAnimationFrame(() => setLoaderIn(true));

    // Two gates open the entrance: the min loader time, and the grid's onReady
    // (precompute done). maybeEnter() fires the entrance once both are in; the
    // MAX cap is a safety net so we never hang waiting on precompute.
    after(MIN_LOADER_MS, () => {
      minElapsedRef.current = true;
      maybeEnter();
    });
    after(MAX_LOADER_MS, startEntrance);

    return () => {
      cancelAnimationFrame(raf);
      pending.forEach((id) => clearTimeout(id));
      pending.clear();
    };
  }, [after, maybeEnter, startEntrance]);

  // Lock page scroll while the full-screen loader is up (nothing scrolls until the
  // field is precomputed and the loader dismisses).
  useEffect(() => {
    if (!showLoader) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [showLoader]);

  const revealed = phase !== "loading";

  return (
    <>
      {/* contain + will-change isolate the hero ring's compositing layer and
          dirty-rect (free SVG paint headroom; size-containment omitted as the
          svg uses height:auto). */}
      <style>{`.sth-mainring { width: 100%; height: auto; display: block; contain: layout paint style; will-change: contents; }`}</style>

      {/* full-bleed backdrop: smooth radial (dark = neutral grey, light = white) */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, zIndex: 0, background: backdrop(theme) }}
      />

      {/* ambient field of small rings — starts hidden (intro), revealed by us.
          onReady gates the loader on the field's thumbnail precompute. The exit
          COLLAPSE is PER-CELL inside StructureGrid (each near cell gently sucks
          toward the centre hole + shrinks, distance-weighted from the centre — a
          one-shot CSS transition, ambient paused). The parent fades the layer. */}
      <StructureGrid
        ref={gridRef}
        intro={motionOK}
        theme={theme}
        active={active}
        exiting={exiting}
        onReady={onGridReady}
      />

      {/* fade the field to the backdrop toward the bottom */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          filter: "blur(22px)",
          zIndex: 1,
          background: bottomFade(theme.fadeTo),
        }}
      />

      {/* the big hero ring — blooms colourful then relaxes; self-morphs on its timer */}
      <StructureHeroRing seed={heroSeed} entered={entered} theme={theme} paused={!active} exiting={exiting} />

      {/* tagline — fades in with the reveal; fades out with the layer on exit. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "0 24px",
          transform: "translateY(12px)",
          paddingBottom: "calc(clamp(28px, 6vh, 64px) + env(safe-area-inset-bottom, 0px))",
          pointerEvents: "none",
          zIndex: 4,
          opacity: revealed ? 1 : 0,
          transition: `opacity 600ms ease ${revealed ? 250 : 0}ms`,
        }}
      >
        {/* STM long wordmark (public/STM logo long text.svg) — now a SMALL,
            secondary mark above the headline (the headline carries the hero).
            Black artwork, so dark mode inverts it to white. Decorative: the
            brand name is already announced by the nav's home link, so this
            stays out of the a11y tree; the headline below is the real <h1>. */}
        <div
          aria-hidden="true"
          style={{
            width: "clamp(110px, 18vw, 160px)",
            aspectRatio: "806 / 127",
            backgroundImage: "url('/STM%20logo%20long%20text.svg')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "contain",
            filter: theme.dark ? "invert(1)" : undefined,
          }}
        />
        <h1
          style={{
            margin: "16px 0 0",
            maxWidth: 640,
            fontFamily: FONT,
            fontSize: "clamp(1.5rem, 3.4vw, 2.2rem)",
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: "-0.02em",
            color: theme.text,
            textWrap: "balance",
          }}
        >
          We build software, products, and ventures.
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            maxWidth: 560,
            fontFamily: FONT,
            fontSize: "clamp(1rem, 1.6vw, 1.15rem)", // secondary to the headline above
            fontWeight: 400,
            lineHeight: 1.55,
            letterSpacing: "-0.01em",
            color: theme.subtext,
          }}
        >
          A small multidisciplinary team across finance, engineering, AI, and design.
        </p>
      </div>

      {/* loading overlay — full-page (fixed, above everything incl. the nav),
          a small animated mark blooming in on the theme backdrop. Scroll is
          locked (see effect) until precompute is done and this dismisses. */}
      {showLoader && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: theme.bg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            pointerEvents: loaderFading ? "none" : "auto",
            opacity: loaderFading ? 0 : 1,
            transition: `opacity ${LOADER_FADE_MS}ms ease`,
          }}
        >
          <div
            style={{
              transformOrigin: "center center",
              transform: `scale(${loaderIn ? 1 : 0.72})`,
              opacity: loaderIn ? 1 : 0,
              transition: `transform 520ms ${EASE_OUT_BACK}, opacity 420ms ease-out`,
            }}
          >
            {/* original loader mark: the wire continuously twists through shapes */}
            <StmRing size={LOADER_SIZE} animate baseColors={theme.ringBase} />
          </div>
          {/* brand wordmark, matching the bottom tagline (black art ⇒ invert on dark) */}
          <div
            aria-hidden="true"
            style={{
              width: 168,
              aspectRatio: "806 / 127",
              backgroundImage: "url('/STM%20logo%20long%20text.svg')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "contain",
              filter: theme.dark ? "invert(1)" : undefined,
              opacity: loaderIn ? 0.92 : 0,
              transform: `translateY(${loaderIn ? 0 : 6}px)`,
              transition: "opacity 520ms ease 140ms, transform 520ms ease 140ms",
            }}
          />
        </div>
      )}
    </>
  );
}
