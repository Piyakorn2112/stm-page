/**
 * Cta — "Built to become": centred call to action with a large faint twisted-ring
 * decoration bleeding behind it. Centred on all breakpoints (a focal statement).
 */
import StaticRing from "@/components/graphic/StaticRing/StaticRing";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

export function Cta() {
  return (
    <section id="contact" className={"section"} style={accent("var(--orange)")}>
      <div className={styles.decorRing} style={{ width: 720, height: 720, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
        <StaticRing seed="built-to-become" />
      </div>
      <div className={`container ${styles.cta}`}>
        <h2 className={styles.ctaHeading}>
          Built to <em className={"accentWord"}>become</em>.
        </h2>
        <p className={styles.ctaSub}>
          Structure makes future expression possible. Bring us a name, a product, a program.
          We&rsquo;ll give it structure.
        </p>
        <div className={styles.ctaActions}>
          <a className={styles.btnPrimary} href="#top">
            Start a conversation
          </a>
          <a className={styles.btnGhost} href="#about">
            Explore the system
          </a>
        </div>
      </div>
    </section>
  );
}
