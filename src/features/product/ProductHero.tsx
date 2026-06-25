"use client";

/**
 * ProductHero — the /product landing hero. Follows the shared hero convention
 * (full-viewport 100dvh section, clipped, HeroScrollIndicator pinned bottom-centre).
 *
 * Composition:
 *   • the animated brand ring, centred on a point near the TOP, blooming up on enter;
 *   • the product logos riding a circular ARC whose centre is BELOW the content — so
 *     they ride the TOP of a dome and rise up from the bottom as they cycle, peaking
 *     (full size) at the dome's apex, staying upright (counter-rotated) so they read;
 *   • the headline between the ring and the rising arc.
 *
 * The ring is locked to one seed (RING_SEED) and painted in the custom full-colour
 * `colorCycle` mode (the whole wire cycles vividly through the three brand colours in
 * OKLab — see HeroTwistRing). The logos are monochrome SVGs masked with `var(--fg)`,
 * so they re-colour themselves correctly in light AND dark mode (see styles).
 *
 * Enter: the ring scales up (expressive overshoot) while it blooms; the headline and
 * the logo arc fade/slide in on a short stagger after it. Honours reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { PALETTE } from "@stm-ring";
import HeroTwistRing from "@/components/graphic/HeroStructure/HeroTwistRing";
import HeroScrollIndicator from "@/components/ui/HeroScrollIndicator/HeroScrollIndicator";
import styles from "./product.module.css";

const RING_SEED = "o39989";
const RING_SEED_1 = "o3998";

// The four products, in the order they ride the arc.
const LOGOS = [
  { slug: "members", src: "/logos/logo-members-black.svg", label: "Members" },
  { slug: "cmission", src: "/logos/logo-cmission-black.svg", label: "CMission" },
  { slug: "beacon", src: "/logos/logo-beacon-black.svg", label: "Beacon" },
  { slug: "latent-write", src: "/logos/logo-latenwrite-black.svg", label: "Latent Write" },
] as const;

// Ring diameter from the live viewport — large/expansive (it may bleed past the left &
// right edges). Sized off the LARGER side so it stays grand on tall phones too.
const ringSizeFor = (vw: number, vh: number) =>
  Math.round(Math.max(520, Math.min(Math.max(vw, vh) * 0.96, 1320)));

export default function ProductHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState(0);
  const [paused, setPaused] = useState(false);
  const [entered, setEntered] = useState(false);

  // Size the ring off the live viewport.
  useEffect(() => {
    const onResize = () => setSize(ringSizeFor(window.innerWidth, window.innerHeight));
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Play the entrance once on mount. Always via rAF (so it transitions from the
  // initial hidden state); under reduced-motion the CSS transitions are off, so this
  // just snaps to the final state with no animation.
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Pause the ring's rAF loop whenever the hero is fully scrolled away.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`${styles.hero}${entered ? ` ${styles.entered}` : ""}`}
      aria-label="Our products"
    >
      {/* the ring, centred on a point near the top. Two concentric layers: a bigger,
          fainter back layer counter-rotating under the front layer. */}
      <div className={styles.stage}>
        <div className={styles.ring}>
          <div className={styles.ringFxBack}>
            {size > 0 && (
              <HeroTwistRing
                seed={RING_SEED}
                size={size}
                colorCycle={PALETTE}
                paused={paused}
                segments={280}
                pieces={120}
              />
            )}
          </div>
        </div>
        <div className={styles.ring}>
          <div className={styles.ringFxFront}>
            {size > 0 && (
              <HeroTwistRing seed={RING_SEED_1} size={size} colorCycle={PALETTE} paused={paused} />
            )}
          </div>
        </div>
      </div>

      <h1 className={styles.heroTitle}>
        Products across{" "}
        <span className={styles.tagWord}>
          systems,
        </span>{" "}
        and{" "}
        <span className={styles.tagWord}>
          everyday
        </span>{" "}
        use.
      </h1>

      <HeroScrollIndicator variant="blend" />
    </section>
  );
}
