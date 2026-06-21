"use client";

/**
 * StructureHeroRing — the big centred brand ring for /structure, plus the white
 * radial wash that softens where the small-ring field gives way to it. (Named
 * to avoid the unrelated, archived `HeroRing` used by /hero.)
 *
 * It measures the viewport with window.inner* (NOT CSS vmin/vh) and sizes the
 * ring from the SAME `ringSize` the grid uses to clear space. Sharing one
 * measurement is what keeps the ring and its clearing perfectly aligned on
 * every device — including mobile Safari, where CSS viewport units and
 * window.inner* disagree while the address bar shows/hides.
 *
 * The wash hugs the ring's round REST wire (wireFrac) with a small gap, so the
 * field hugs the ring tightly and roundly — not its square bounding box.
 *
 * The ring is the renderer's default variant: black at rest, blooming into the
 * brand colours on hover.
 *
 * ENTRANCE / LIVING (opt-in, driven by StructureScene; defaults reproduce the
 * old render exactly). `entered` toggles a CSS scale-up bloom (small overshoot)
 * from BLOOM_FROM→1. `seed` is forwarded to StmRing's existing `forceSeed`:
 * setting it blooms the ring into that colourful twisted "flower" (charge on);
 * clearing it relaxes back to the resting black ring — which is exactly how the
 * scene plays both the entrance and the periodic self-morphs, with no change to
 * the shared core or StmRing.
 */

import { memo, useEffect, useState } from "react";
import { StmRing } from "@stm-ring";
import HeroTwistRing from "./HeroTwistRing";
import { RING_GEOM, ringSize } from "./StructureGrid";
import { LIGHT_THEME, type StructureTheme } from "./structureTheme";

// Render the hero with the Canvas renderer (kills the SVG per-frame re-raster
// stutter; "Still Water" spring reveal). Flip to false for the original SVG StmRing.
const USE_CANVAS_HERO = true;

// Entrance bloom: the hero ring scales up from this fraction with a soft
// overshoot (matches the field's easeOutBack feel).
const BLOOM_FROM = 0.22;
const BLOOM_MS = 760;
const BLOOM_EASE = "cubic-bezier(0.34, 1.4, 0.64, 1)";

// Scripted exit (must match HomeReveal SETTLE_MS / EXIT_MS): the ring gently
// shrinks toward the centre hole; the parent layer does the fade. One CSS
// transition, ambient paused ⇒ smooth.
const EXIT_MS = 1100;
const EXIT_DELAY_MS = 220;
const EXIT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const RING_EXIT_SCALE = 0.5; // gentle (reduced suction)

// Strand resolution scaled to the DISPLAYED ring size: a smaller ring (phones)
// needs fewer samples for identical perceived detail, so this cuts the hero
// ring's per-frame cost on exactly the devices that need it — without changing
// the look (detail-per-pixel stays constant). Full 560/240 at the design size
// (~540px+); floors keep it crisp on the smallest screens. Ratio ≈ 560/240.
//
// CRUCIAL: `segments` MUST be a multiple of `step = round(segments/pieces)`.
// assemble() tiles the wire into chunks of `step`; if it doesn't divide evenly
// the LAST chunk is short, so that strand's gradient has fewer stops than the
// rest — and StmRing builds every gradient with strand[0]'s stop count, leaving
// the short strand's trailing <stop>s undefined, which SVG paints SOLID BLACK
// (a black segment artifact). Snapping `segments` down to a multiple of `step`
// keeps every strand the same length. Verified artifact-free across 280–580px.
const heroRes = (size: number) => {
  const target = Math.max(360, Math.min(560, Math.round(size * 1.05)));
  const pieces = Math.round(target / 2.33);
  const step = Math.max(1, Math.round(target / pieces));
  const segments = target - (target % step); // multiple of step ⇒ equal-length strands
  return { segments, pieces };
};

function StructureHeroRing({
  seed = null,
  entered = true,
  theme = LIGHT_THEME,
  paused = false,
  exiting = false,
}: {
  /** Forwarded to StmRing `forceSeed`: a seed blooms the colourful flower; null relaxes to rest. */
  seed?: string | number | null;
  /** false ⇒ pre-bloom (tiny, hidden); flip to true to scale up. Default true = no-op. */
  entered?: boolean;
  /** Colour theme. Default LIGHT ⇒ byte-identical to before. Dark recolours the rest
   *  wire (glow ramp) and the clearing wash. */
  theme?: StructureTheme;
  /** Suspend the ring's animation loop (off-screen). Forwarded to StmRing. */
  paused?: boolean;
  /** true ⇒ scripted exit: gently shrink toward the centre (CSS transition). */
  exiting?: boolean;
}) {
  const [vp, setVp] = useState<{ vw: number; vh: number } | null>(null);

  useEffect(() => {
    const measure = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!vp) return null; // appears on mount, in step with the (also-measured) grid

  const size = ringSize(vp.vw, vp.vh);
  const cy = vp.vh * RING_GEOM.cyFrac;
  const wire = size * RING_GEOM.wireFrac; // round rest-wire radius (px)
  const washInner = wire + RING_GEOM.hugGap; // solid clearing colour to here
  const washOuter = washInner + RING_GEOM.washSoft; // faded out by here
  const forceSeed = seed != null ? String(seed) : null;
  const { segments, pieces } = heroRes(size);

  return (
    <>
      {/* wash hugging the ring's round wire (px-matched to the clearing); the
          clearing takes the backdrop's CENTRE colour so it blends seamlessly into
          the radial in both light and dark */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          // Shrink with the ring on the scripted exit (matched scale about the hero
          // centre), so the clearing closes as the ring does. Parent fades it.
          transformOrigin: `50% ${cy}px`,
          transform: `scale(${exiting ? RING_EXIT_SCALE : 1})`,
          transition: `transform ${EXIT_MS}ms ${EXIT_EASE} ${EXIT_DELAY_MS}ms`,
          background: `radial-gradient(circle ${washOuter}px at 50% ${cy}px, ${theme.bgCenter} 0, ${theme.bgCenter} ${washInner}px, transparent ${washOuter}px)`,
        }}
      />

      {/* EXIT wrapper — on the scripted exit the ring gently shrinks toward the
          hero centre (the "hole"); the parent layer fades it. One CSS transition,
          separate from the bloom wrapper so the entrance transition is untouched. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          pointerEvents: "none",
          transformOrigin: `50% ${cy}px`,
          transform: `scale(${exiting ? RING_EXIT_SCALE : 1})`,
          transition: `transform ${EXIT_MS}ms ${EXIT_EASE} ${EXIT_DELAY_MS}ms`,
          willChange: exiting ? "transform" : undefined,
        }}
      >
      {/* the hero ring — entrance bloom only; it does NOT scale on the interval
          reaction (the field does the scaling). Interval-driven, not hoverable. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${cy}px`,
          transformOrigin: "center center",
          transform: `translate(-50%, -50%) scale(${entered ? 1 : BLOOM_FROM})`,
          opacity: entered ? 1 : 0,
          transition: `transform ${BLOOM_MS}ms ${BLOOM_EASE}, opacity ${BLOOM_MS}ms ease-out`,
          width: size,
          pointerEvents: "none",
        }}
      >
        {USE_CANVAS_HERO ? (
          <HeroTwistRing
            seed={forceSeed}
            size={Math.round(size)}
            segments={segments}
            pieces={pieces}
            baseColors={theme.ringBase}
            paused={paused}
          />
        ) : (
          <StmRing
            className="sth-mainring"
            size={Math.round(size)}
            segments={segments}
            pieces={pieces}
            fps={70}
            forceSeed={forceSeed}
            baseColors={theme.ringBase}
            hoverable={false}
            paused={paused}
          />
        )}
      </div>
      </div>
    </>
  );
}

// Memoised: scene re-renders that don't change the hero's props (loader/phase
// state during the entrance) won't re-render the ring.
export default memo(StructureHeroRing);
