"use client";

/**
 * HeroScrollIndicator — a subtle "Scroll Down" cue pinned near the bottom edge of a hero.
 * The inner label mostly rests at low opacity and occasionally rises a few px / brightens
 * (a crafted pulse on the standard ease, no overshoot). The outer span fades the whole cue
 * OUT once the user starts scrolling down, and back IN near the top — a smooth opacity
 * transition. Decorative only (aria-hidden); colour follows the theme; the pulse respects
 * reduced-motion. Absolutely positioned, so it expects a `position: relative` hero.
 */
import { useEffect, useState } from "react";
import styles from "./styles.module.css";

const HIDE_AFTER = 60; // px scrolled before the cue fades out

export default function HeroScrollIndicator({ className }: { className?: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > HIDE_AFTER);
    onScroll(); // sync on mount (e.g. a reload mid-page)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <span
      className={`${styles.indicator}${hidden ? ` ${styles.hidden}` : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span className={styles.label}>Scroll Down</span>
    </span>
  );
}
