/**
 * Sections — the company page below the hero, written from the SRANG TECH MAI
 * brief: a system company, "structure for what's next." Calm white/near-black
 * surfaces; brand primaries appear only as accents. The live ring is the hero's
 * alone — every ring down here is a STATIC twisted form (StaticRing), used for
 * the employee identity grid and faint decoration. Mostly static; the one piece
 * of motion is the identity grid's gentle stagger reveal.
 *
 * Sections use `content-visibility:auto`; the identity grid builds its rings
 * only when scrolled into view. Server components except the static rings.
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { Boxes, Fingerprint, Zap } from "lucide-react";
import StaticRing from "./StaticRing";
import IdentityGrid from "./IdentityGrid";
import SoftRingsField from "./SoftRingsField";
import ArcField from "./ArcField";
import FlowField from "./FlowField";
import styles from "./site.module.css";

const accent = (v: string) => ({ ["--accent"]: v } as CSSProperties);

/* 2 — MISSION ────────────────────────────────────────────────────────────── */
/* Graphic LEFT (the three brand soft-bodies pressing into one), text RIGHT and
 * smaller; both stack and centre on mobile. The graphic only animates once it
 * scrolls into view (see SoftRingsField), so it never competes with the hero. */
export function Mission() {
  return (
    <section id="about" className={styles.section}>
      <div className={`${styles.container} ${styles.missionSplit}`}>
        <div className={styles.missionVisual}>
          <SoftRingsField />
        </div>
        <div className={styles.missionText}>
          <h2 className={styles.missionHeading}>
            <em className={styles.accentWord} style={{ color: "var(--orange)" }}>Creativity</em>,{" "}
            <em className={styles.accentWord} style={{ color: "var(--blue)" }}>engineering</em>, and{" "}
            <em className={styles.accentWord} style={{ color: "var(--indigo)" }}>intelligence</em> &mdash;
            pulled into one system.
          </h2>
          <p className={styles.missionLede}>
            Not just a software house. A place where design, engineering, and identity are treated
            as one &mdash; held under structure and pressure until they become a single, living
            identity.
          </p>
        </div>
      </div>
    </section>
  );
}

/* 3 — PHILOSOPHY ─────────────────────────────────────────────────────────── */
export function Philosophy() {
  return (
    <section id="philosophy" className={`${styles.section} ${styles.sectionAlt} ${styles.philFull}`}>
      {/* full-bleed ring-environment behind the copy: the ring breathes in the open
          space and product icons continuously bubble out of it. The text carries a
          reserve hitbox (data-arc-reserve) so icons never slide under it. */}
      <ArcField className={styles.philArcBg} />
      <div className={styles.container}>
        <div className={`${styles.philText}`} data-arc-reserve>
          <span className={styles.eyebrow}>Philosophy</span>
          <h2 className={styles.missionHeading}>
            Structure for what&rsquo;s <em className={styles.accentWord}>next</em>.
          </h2>
          <p className={styles.missionLede}>
            The ring is the environment in which new ideas land and take shape &mdash;
            foundations strong enough to support many products, many people, and many futures,
            without losing identity along the way.
          </p>
        </div>
      </div>
    </section>
  );
}

/* 4 — WHERE IT TAKES FORM ─────────────────────────────────────────────────── */
const PILLARS = [
  { Icon: Fingerprint, t: "Identity Systems", d: "Living identities that adapt without losing clarity." },
  { Icon: Boxes, t: "Product Systems", d: "Tools and platforms designed to evolve, not reset." },
  { Icon: Zap, t: "Interaction Systems", d: "Behavior-driven interfaces that respond, not just display." },
];

export function TakesForm() {
  return (
    <section id="form" className={styles.section} style={accent("var(--blue)")}>
      <div className={`${styles.container} ${styles.formSplit}`}>
        <div className={styles.formFlow}>
          <FlowField className={styles.formFlowCanvas} />
        </div>
        <div className={styles.formText}>
          <span className={styles.eyebrow}>Where it takes form</span>
          <h2 className={styles.heading}>
            From structure to <em className={styles.accentWord}>reality</em>.
          </h2>
          <p className={styles.lede}>
            What we build is never separate from how we think &mdash; every system begins as
            structure.
          </p>
          <p className={styles.body}>
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

/* 5 — IDENTITY (employee ring grid) ──────────────────────────────────────── */
export function Identity() {
  return (
    <section id="identity" className={`${styles.section} ${styles.sectionAlt}`} style={accent("var(--orange)")}>
      <div className={`${styles.container} ${styles.idSplit}`}>
        <div className={styles.idText}>
          <span className={styles.eyebrow}>How we work</span>
          <h2 className={styles.heading}>
            Systems of people, not <em className={styles.accentWord}>roles</em>.
          </h2>
          <p className={styles.lede}>
            We don&rsquo;t organize by rigid roles or departments. Small, high-context teams where
            design, engineering, and thinking live together &mdash; each owning outcomes, not handoffs.
          </p>
          <p className={styles.body}>
            Every person carries their own generated ring, and works the way the system does:
            multi-disciplinary, high-agency, aligned but never boxed in.
          </p>
          <Link className={styles.idLink} href="/build">
            How we work <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
        <div className={styles.idGridWrap}>
          <IdentityGrid />
        </div>
      </div>
    </section>
  );
}

/* 6 — CTA ────────────────────────────────────────────────────────────────── */
export function CtaSection() {
  return (
    <section id="contact" className={styles.section} style={accent("var(--orange)")}>
      <div className={styles.decorRing} style={{ width: 720, height: 720, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
        <StaticRing seed="built-to-become" />
      </div>
      <div className={`${styles.container} ${styles.cta}`}>
        <h2 className={styles.ctaHeading}>
          Built to <em className={styles.accentWord}>become</em>.
        </h2>
        <p className={styles.ctaSub}>
          Structure makes future expression possible. Bring us a name, a product, a program &mdash;
          we&rsquo;ll give it structure.
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

/* 9 — FOOTER ─────────────────────────────────────────────────────────────── */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div>
          <a className={styles.footerBrand} href="#top">
            <span className={styles.navDot} aria-hidden="true" />
            Srang Tech Mai
          </a>
          <p className={styles.footerTag}>Structure for what&rsquo;s next.</p>
        </div>
        <div className={styles.footerCols}>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Company</span>
            <a href="#about">About</a>
            <a href="#philosophy">Philosophy</a>
            <a href="#form">Where it takes form</a>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>System</span>
            <a href="#identity">Identity</a>
            <a href="/build">How We Work</a>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Contact</span>
            <a href="#contact">Get in touch</a>
          </div>
        </div>
      </div>
      <div className={styles.container}>
        <p className={styles.footerNote}>© {new Date().getFullYear()} Srang Tech Mai. Structure for what&rsquo;s next.</p>
      </div>
    </footer>
  );
}
