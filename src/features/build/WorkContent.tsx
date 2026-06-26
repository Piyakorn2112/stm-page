/**
 * WorkContent — the "How We Work" page body, below the interactive badge hero.
 * Reads as the system behind the people who build STM: opening statement → how we
 * operate → aligned-not-isolated (with the structural diagram) → who fits / who
 * doesn't → closing. Reuses the site's editorial language (eyebrow / heading /
 * accentWord / lede / body) so it sits in the same "museum flow" as the homepage;
 * each section carries its OWN accent (indigo / blue / orange), used sparingly.
 */

import type { CSSProperties } from "react";
import { Blend, Boxes, Check, Gem, Hand, Minus, Network, Palette, PackageOpen, Users } from "lucide-react";
import styles from "@/features/build/build.module.css";
import AlignmentDiagram from "./AlignmentDiagram";
import TeamField from "@/components/graphic/TeamField/TeamField";

const accent = (v: string) => ({ ["--accent"]: v } as CSSProperties);

const PRINCIPLES = [
  {
    Icon: Blend,
    t: "Multi-disciplinary by default",
    d: "Designers code. Engineers design. Not because they have to, but because understanding across fields produces better decisions.",
  },
  {
    Icon: Users,
    t: "Small, high-performance teams",
    d: "Teams stay small and focused. Less coordination, more clarity, faster iteration.",
  },
  {
    Icon: PackageOpen,
    t: "Outcome over role",
    d: "We don’t measure contribution by job title. We look at what was built, how well it works, and the thinking behind it.",
  },
  {
    Icon: Hand,
    t: "Deep ownership",
    d: "If you touch it, you own it. From idea to execution: no passing responsibility.",
  },
  {
    Icon: Gem,
    t: "Craft matters",
    d: "Details are not decoration. They are the difference between something that works and something that lasts.",
  },
];

const ALIGN = [
  { Icon: Palette, t: "Design syncs", d: "Keep visual and interaction quality consistent across teams." },
  { Icon: Boxes, t: "Engineering syncs", d: "Align architecture and standards so the parts still fit." },
  { Icon: Network, t: "System-level discussions", d: "Evolve the whole, not just the parts." },
];

const FITS = [
  "You think across disciplines, not inside one",
  "You care about both how things look and how they work",
  "You prefer ownership over instruction",
  "You’re comfortable figuring things out, not waiting for direction",
  "You enjoy refining details, not just finishing tasks",
];

const NOT_FITS = [
  "You prefer clearly defined roles and boundaries",
  "You rely on step-by-step direction to move forward",
  "You separate “design work” and “engineering work” strictly",
  "You optimize for speed over quality and thought",
];

export default function WorkContent() {
  return (
    <>
      {/* Opening statement — indigo */}
      <section className={"section"} style={accent("var(--indigo)")}>
        <div className={`container ${styles.workCenter}`}>
          <span className={"eyebrow"}>Systems of people</span>
          <h2 className={"heading"}>
            Not roles. Not departments. Systems of <em className={"accentWord"}>people</em>.
          </h2>
          <p className={"lede"}>
            We don’t organize work by rigid roles. We build small, high-context teams where design,
            engineering, and thinking exist together, not in sequence.
          </p>
          <p className={"body"}>
            Each team is responsible for outcomes, not handoffs. Ideas don’t wait in queues. They
            evolve in place.
          </p>
        </div>
      </section>

      {/* How we operate — orange */}
      <section className={`section sectionAlt`} style={accent("var(--orange)")}>
        <div className={"container"}>
          <span className={"eyebrow"}>How we operate</span>
          <h2 className={"heading"}>
            The way we <em className={"accentWord"}>build</em>.
          </h2>
          <div className={styles.principles}>
            {PRINCIPLES.map(({ Icon, t, d }) => (
              <div key={t} className={styles.principle}>
                <div className={styles.principleIconWrap}>
                  <Icon className={styles.principleIcon} size={20} strokeWidth={2.3} aria-hidden />
                </div>
                <h3 className={styles.principleTitle}>{t}</h3>
                <p className={styles.principleDesc}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Aligned, not isolated — blue (structure, matching the homepage) */}
      <section className={"section"} style={accent("var(--blue)")}>
        <div className={`container ${styles.alignSplit}`}>
          <div className={styles.alignVisual}>
            <TeamField className={styles.teamField} />
          </div>
          <div className={styles.alignText}>
            <span className={"eyebrow"}>Structure</span>
            <h2 className={"heading"}>
              Aligned, not <em className={"accentWord"}>isolated</em>.
            </h2>
            <p className={"lede"}>Teams operate independently, but not in isolation.</p>
            <p className={"body"}>Across teams, we maintain shared layers of alignment:</p>
            <ul className={styles.alignList}>
              {ALIGN.map(({ Icon, t, d }) => (
                <li key={t} className={styles.alignItem}>
                  <Icon className={styles.alignIcon} size={21} strokeWidth={2.3} aria-hidden />
                  <span className={styles.alignBody}>
                    <span className={styles.alignItemT}>{t}</span>
                    <span className={styles.alignItemD}>{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <AlignmentDiagram className={styles.alignDiagramInline} />
            <p className={"body"}>
              This keeps the system coherent, without slowing down individual teams.
            </p>
          </div>
        </div>
      </section>

      {/* Who fits / who doesn't — indigo */}
      <section className={`section sectionAlt`} style={accent("var(--indigo)")}>
        <div className={"container"}>
          <span className={"eyebrow"}>The fit</span>
          <h2 className={"heading"}>
            Who <em className={"accentWord"}>thrives</em> here.
          </h2>
          <div className={styles.fitCols}>
            <div className={styles.fitCol}>
              <h3 className={styles.fitHead}>You’ll feel at home here if…</h3>
              <ul className={styles.fitList}>
                {FITS.map((f) => (
                  <li key={f} className={styles.fitItem}>
                    <Check className={styles.fitIcon} size={18} strokeWidth={2.6} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${styles.fitCol} ${styles.fitColMuted}`}>
              <h3 className={styles.fitHead}>This might not be for you if…</h3>
              <ul className={styles.fitList}>
                {NOT_FITS.map((f) => (
                  <li key={f} className={styles.fitItemMuted}>
                    <Minus className={styles.fitIcon} size={18} strokeWidth={2.6} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Closing — orange */}
      <section className={"section"} style={accent("var(--orange)")}>
        <div className={`container ${styles.workCenter}`}>
          <span className={"eyebrow"}>Not yet hiring</span>
          <h2 className={"heading"}>
            We’re not hiring yet. But we’re <em className={"accentWord"}>building</em>.
          </h2>
          <p className={"lede"}>
            We’re still shaping the system. If this way of working resonates with you, you’ll likely
            find your way here when the time is right.
          </p>
        </div>
      </section>
    </>
  );
}
