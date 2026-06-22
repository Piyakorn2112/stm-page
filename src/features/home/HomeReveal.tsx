"use client";

/**
 * HomeReveal — the hero is a normal 100dvh section at the top of the scroll flow.
 * It just scrolls away like any other section (no scroll animation). The hero
 * pauses its ambient loop when it scrolls out of view, and the content mounts
 * after the entrance peak.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import StructureScene from "@/components/graphic/HeroStructure/StructureScene";
import HeroScrollIndicator from "@/components/ui/HeroScrollIndicator/HeroScrollIndicator";
import styles from "@/features/home/home.module.css";

export default function HomeReveal({ children }: { children: ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // Pause the hero's ambient loop whenever it is scrolled out of view.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Mount the content after the entrance peak (or first scroll, or fallback).
  useEffect(() => {
    if (showContent) return;
    const reveal = () => setShowContent(true);
    window.addEventListener("scroll", reveal, { passive: true, once: true });
    const t = window.setTimeout(reveal, 4000);
    return () => {
      window.removeEventListener("scroll", reveal);
      window.clearTimeout(t);
    };
  }, [showContent]);

  return (
    <>
      <section ref={heroRef} id="top" className={styles.hero} aria-label="Srang Tech Mai">
        <StructureScene active={active} onEntered={() => setShowContent(true)} />
        <HeroScrollIndicator />
      </section>
      {showContent && children}
    </>
  );
}
