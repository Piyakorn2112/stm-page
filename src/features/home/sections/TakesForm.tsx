/**
 * TakesForm — "Where it takes form": a vertical soft-body channel (FlowField) beside the
 * copy; one ring at a time morphs circle → twisted STM form as it flows up the column.
 */
import { Boxes, Fingerprint, Zap } from "lucide-react";
import FlowField from "@/components/graphic/FlowField/FlowField";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

const PILLARS = [
  { Icon: Fingerprint, t: "Identity Systems", d: "Living identities that adapt without losing clarity." },
  { Icon: Boxes, t: "Product Systems", d: "Tools and platforms designed to evolve, not reset." },
  { Icon: Zap, t: "Interaction Systems", d: "Behavior-driven interfaces that respond, not just display." },
];

export function TakesForm() {
  return (
    <section id="form" className={"section"} style={accent("var(--blue)")}>
      <div className={`container ${styles.formSplit}`}>
        <div className={styles.formFlow}>
          <FlowField className={styles.formFlowCanvas} />
        </div>
        <div className={styles.formText}>
          <span className={"eyebrow"}>Where it takes form</span>
          <h2 className={"heading"}>
            From structure to <em className={"accentWord"}>reality</em>.
          </h2>
          <p className={"lede"}>
            What we build is never separate from how we think &mdash; every system begins as
            structure.
          </p>
          <p className={"body"}>
            Then it&rsquo;s pushed, tested, and refined until it holds under real use: technically
            and behaviorally, not just visually. We design identities that scale, tools that evolve,
            and systems that stay coherent as they grow &mdash; because what matters isn&rsquo;t
            making something new, but ensuring it can keep becoming.
          </p>
          <div className={styles.formPillars}>
            {PILLARS.map(({ Icon, t, d }) => (
              <div key={t} className={styles.formPillar}>
                <Icon className={styles.formPillarIcon} size={20} strokeWidth={2.2} aria-hidden />
                <div>
                  <p className={styles.formPillarTitle}>{t}</p>
                  <p className={styles.formPillarDesc}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
