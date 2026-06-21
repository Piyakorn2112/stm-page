"use client";

/**
 * IdentityGrid — an 8×4 field of static twisted rings, one per person. Each ring
 * is generated deterministically from a member's id, so it's unmistakably theirs
 * (and unmistakably Srang). The grid only builds its rings once it scrolls into
 * view (32 static generations, off the entrance path), then reveals them in a
 * gentle stagger — the system "issuing" each identity. No live/animated rings.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import StaticRing from "./StaticRing";
import styles from "./site.module.css";

// Stand-in roster (seed = member id). Distinct strings ⇒ distinct rings.
const PEOPLE = [
  "Ananya", "Krit", "Mei", "Theo", "Sofia", "Arjun", "Lena", "Diego",
  "Yuki", "Nadia", "Omar", "Priya", "Liam", "Hana", "Tomas", "Zara",
  "Ravi", "Elin", "Kofi", "Mira", "Jonas", "Aisha", "Pavel", "Noa",
  "Sora", "Bao", "Ines", "Mateo", "Freya", "Idris", "Lucia", "Wei",
];

export default function IdentityGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [inview, setInview] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInview(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInview(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.idGrid} ${inview ? styles.idGridIn : ""}`}>
      {PEOPLE.map((id, i) => (
        <div
          key={id}
          className={styles.idCell}
          style={{ ["--d"]: `${i * 26}ms` } as CSSProperties}
          title={id}
        >
          {inview && <StaticRing seed={id} segments={140} pieces={35} />}
        </div>
      ))}
    </div>
  );
}
