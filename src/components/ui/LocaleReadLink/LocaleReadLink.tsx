"use client";

/**
 * LocaleReadLink — an ambient, per-section language affordance. Instead of a nav toggle, a
 * single "read in the other language" link sits at the bottom of each section's text, and
 * fades in VERY subtly only while that section is the one in view (so it's never shown in
 * every section at once). The fade is slow and small enough that it feels like it was always
 * there rather than appearing. The label is always in the TARGET language:
 *   • on English → "อ่านภาษาไทย"   (offer Thai)
 *   • on Thai    → "Read in English" (offer English)
 * It links to the SAME path in the other locale (next-intl navigation preserves the route).
 */
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import styles from "./styles.module.css";

const OTHER = { en: "th", th: "en" } as const;
// label is in the language being OFFERED (the target)
const LABEL: Record<"en" | "th", string> = { th: "อ่านภาษาไทย", en: "Read in English" };

export default function LocaleReadLink() {
  const locale = useLocale();
  const pathname = usePathname();
  const target = OTHER[(locale as "en" | "th") ?? "en"] ?? "th";
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    // Visible only while this link sits within the comfortable reading band of the viewport.
    // Because the links live at section bottoms (far apart), at most one is in the band at a
    // time — so it's never shown in every section at once.
    const io = new IntersectionObserver(([entry]) => setShown(entry.isIntersecting), {
      rootMargin: "-10% 0px -14% 0px",
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.wrap}${shown ? ` ${styles.shown}` : ""}`}>
      <Link href={pathname} locale={target} className={styles.link}>
        {LABEL[target]}
      </Link>
    </div>
  );
}
