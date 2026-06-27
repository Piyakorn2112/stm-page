/**
 * CtaSection — a centered, page-closing call-to-action. Uses the same solid-pill button
 * as the nav CTA (same Asterisk icon, same solid `var(--fg)` fill → auto-inverts in dark)
 * but at page scale. Accepts page-specific copy; the structural layout — centred column,
 * section-scale heading, short body, then the pill — stays constant.
 */
import { Asterisk } from "lucide-react";
import { Link } from "@/i18n/navigation";
import styles from "./styles.module.css";

export default function CtaSection({
  eyebrow,
  title,
  body,
  ctaLabel = "Contact Us",
  ctaHref = "/contact",
  alt = false,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Use the tinted `.sectionAlt` background (default: plain `.section`). */
  alt?: boolean;
}) {
  return (
    <section className={`section${alt ? " sectionAlt" : ""} ${styles.ctaSection}`}>
      <div className={`container ${styles.inner}`}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className={`heading ${styles.ctaTitle}`}>{title}</h2>
        <p className={`lede ${styles.ctaBody}`}>{body}</p>
        <Link href={ctaHref} className={styles.ctaBtn}>
          <Asterisk size={16} strokeWidth={2.5} aria-hidden />
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
