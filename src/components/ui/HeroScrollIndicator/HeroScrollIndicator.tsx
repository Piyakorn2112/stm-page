"use client";

/**
 * HeroScrollIndicator — a subtle "Scroll Down" cue pinned near the bottom edge of a hero.
 * The label mostly rests at low opacity and occasionally rises a few px / brightens (a crafted
 * pulse on the standard ease, no overshoot); a hairline tether below it grows in lockstep,
 * visualising the gap that opens as the label lifts, then collapses back as it settles. The
 * outer span fades the whole cue OUT once the user starts scrolling down, and back IN near the
 * top. Decorative only (aria-hidden); colour follows the theme; the pulse respects
 * reduced-motion. Absolutely positioned, so it expects a `position: relative` hero.
 */
import { useEffect, useState } from "react";
import styles from "./styles.module.css";

const HIDE_AFTER = 60; // px scrolled before the cue fades out

export default function HeroScrollIndicator({
  className,
  variant = "default",
}: {
  className?: string;
  /**
   * "default" — themed muted ink (var(--muted)); use over a solid, subtle surface
   *   (the home + /build heroes).
   * "blend" — for heroes WITHOUT a solid backing (e.g. /product, sat over the live
   *   colour ring): paints with `mix-blend-mode: difference` over a neutral grey, which
   *   is a cheap GPU per-pixel blend (no shadow, no JS) that keeps a CONSTANT contrast
   *   against ANY backdrop — equal on white and on black (a grey of value g gives
   *   contrast g against both), tuned to match the default's contrast on a white page.
   */
  variant?: "default" | "blend";
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > HIDE_AFTER);
    onScroll(); // sync on mount (e.g. a reload mid-page)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <span
      className={`${styles.indicator}${variant === "blend" ? ` ${styles.blend}` : ""}${hidden ? ` ${styles.hidden}` : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span className={styles.label}>Scroll Down</span>
      <span className={styles.line} />
    </span>
  );
}
