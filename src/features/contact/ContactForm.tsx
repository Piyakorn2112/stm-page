"use client";

/**
 * ContactForm — the /contact experience. The contact details sit centred in the hero;
 * below them a crafted "sheet of paper" contact form bleeds up into the hero (its top
 * peeks above the fold, inviting a scroll). On submit the paper PLAYFULLY FOLDS into a
 * sealed letter and FLIES AWAY, then a success state emerges in its place.
 *
 * Fold mechanics (see contact.module.css for the full timeline): a tri-fold letter —
 * three stacked panels (thirds); the middle is the anchor, the bottom folds up and the
 * top folds down onto it (two-face panels with translateZ leaf-thickness so backs never
 * z-fight). The top leaf's BACK is styled as the envelope face (flap + postage stamp +
 * address seam). Only transform/opacity animate (compositor-friendly); shadows are
 * separate opacity-ramped layers. Honours reduced-motion (skips straight to success) and
 * announces via an aria-live status region.
 */

import { useState, useEffect, useRef } from "react";
import { Asterisk, ChevronDown, Send } from "lucide-react";
import styles from "./contact.module.css";

/* ── custom select (brand-indigo focus, lucide chevron, custom dropdown) ───────────── */
function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapRef} className={styles.selectWrap}>
      <button
        type="button"
        id={id}
        className={`${styles.input} ${styles.selectTrigger}${!value ? ` ${styles.selectEmpty}` : ""}${open ? ` ${styles.inputFocused}` : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`${styles.selectChevron}${open ? ` ${styles.selectChevronOpen}` : ""}`}
        />
      </button>

      {open && (
        <ul className={styles.selectDropdown} role="listbox">
          {options.map(({ value: v, label }) => (
            <li
              key={v}
              role="option"
              aria-selected={v === value}
              className={`${styles.selectOption}${v === value ? ` ${styles.selectOptionSelected}` : ""}`}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* the postage / wax stamp — the brand Asterisk in a perforated frame */
function Stamp() {
  return (
    <span className={styles.stamp} aria-hidden>
      <Asterisk size={26} strokeWidth={2} />
    </span>
  );
}

/* EnvelopeMark — the crafted, golden-ratio "folded mail" the paper resolves INTO. Three pieces
 * so the reveal can be a PLAYFUL spring (not a fade): a paper BODY (rounded rect + a bright bottom
 * lip + a stamp + an address skeleton) and a separate, crafted FLAP TRIANGLE that folds down from
 * the back in 3D. The flap tip is a wide soft U (the macOS-Mail "crafted paper" cue) reaching
 * ~⅔ down; both SVGs are sized to their own golden-matched boxes so nothing distorts. On send the
 * whole envelope scales up on a spring, the flap folds front with an overshoot, and the stamp +
 * address lines pop in. Tones are --env-* vars (paper-white in light, slate slab in dark). */
function EnvelopeMark() {
  return (
    <div className={styles.envelope} aria-hidden>
      {/* BODY */}
      <svg className={styles.envBody} viewBox="0 0 1000 618" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cf-eBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--env-paper0)" /><stop offset="1" stopColor="var(--env-paper1)" />
          </linearGradient>
          <filter id="cf-eDrop" x="-40%" y="-40%" width="180%" height="200%">
            <feDropShadow dx="0" dy="9" stdDeviation="14" floodColor="var(--env-drop)" floodOpacity="1" />
          </filter>
        </defs>
        <rect x="6" y="6" width="988" height="606" rx="41" fill="url(#cf-eBody)" filter="url(#cf-eDrop)" stroke="var(--env-border)" strokeWidth="2" />
      </svg>

      {/* address skeleton lines (lower-left) + stamp (top-right) — pop in */}
      <div className={styles.envAddr}>
        <span /><span /><span />
      </div>
      <span className={styles.envStamp}>
        <Asterisk size={20} strokeWidth={2} aria-hidden />
      </span>

      {/* FLAP — folds down from the back in 3D; clipped to the envelope's rounded rect so its
          top corners round to match the mail's interior (rx halved to 41 too) */}
      <svg className={styles.envFlap} viewBox="0 0 1000 432" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cf-eFlap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--env-flap0)" /><stop offset="1" stopColor="var(--env-flap1)" />
          </linearGradient>
          <filter id="cf-eFlapSh" x="-20%" y="-10%" width="140%" height="220%">
            <feDropShadow dx="0" dy="11" stdDeviation="13" floodColor="var(--env-ishadow)" floodOpacity="var(--env-ishadow-o)" />
          </filter>
          <clipPath id="cf-eFlapClip"><rect x="6" y="6" width="988" height="606" rx="41" /></clipPath>
        </defs>
        <g clipPath="url(#cf-eFlapClip)">
          {/* sharper tip: the rounded span is tightened ~60% (469.7↔530.3 vs the old 424↔576),
              the diagonals + clipped top corners are unchanged ("other edges stay rounded same") */}
          <path d="M6 6 L994 6 L530 434 Q500 462 470 434 Z" fill="url(#cf-eFlap)" filter="url(#cf-eFlapSh)" stroke="var(--env-border)" strokeWidth="2" strokeLinejoin="round" />
          {/* crease catch-light along the flap's lower edges */}
          <path d="M470 434 Q500 462 530 434" fill="none" stroke="var(--env-rim)" strokeOpacity="var(--env-crease-o)" strokeWidth="2.4" />
        </g>
      </svg>
    </div>
  );
}

const TOPICS = [
  { value: "product", label: "Product inquiry" },
  { value: "partnership", label: "Partnership" },
  { value: "press", label: "Press" },
  { value: "other", label: "Something else" },
];

export default function ContactForm() {
  const [topic, setTopic] = useState("");
  const [sent, setSent] = useState(false);
  const flag = sent ? "1" : "0";

  return (
    <section className={styles.hero}>
      {/* contact details — centred in the first viewport */}
      <div className={styles.heroContact}>
        <a className={styles.email} href="mailto:contact@srangtechmai.tech">
          contact@srangtechmai.tech
        </a>
        <a className={styles.phone} href="tel:+66972733779">
          +66 97 273 3779
        </a>
      </div>

      {/* paper form — bleeds up into the hero bottom; folds + flies on send */}
      <div className={styles.paperStage}>
        <div className={styles.stage}>
          <div className={styles.mailer} data-sent={flag}>
            {/* inner wrapper: the FLY is split across two elements — .mailer animates X (+ fade),
                .mailerInner animates Y + scale + rotate. Two clean 2-stop animations with
                different easings ⇒ a smooth arc with NO mid-flight easing reset (no stutter). */}
            <div className={styles.mailerInner}>
            <span className={styles.restShadow} aria-hidden />

            {/* the folding sheet (paper surface + the "written letter" that the form settles into) */}
            <div className={styles.sheet} aria-hidden>
              {/* TOP third — front = letter top w/ stamp; back = plain paper (the crafted
                  EnvelopeMark below is what the fold resolves into) */}
              <div className={`${styles.panel} ${styles.pTop}`}>
                <div className={`${styles.face} ${styles.front}`}>
                  <Stamp />
                  <span className={styles.lnTitle} />
                </div>
                <div className={`${styles.face} ${styles.back}`} />
                <span className={styles.shade} />
              </div>

              {/* MIDDLE third — the anchor */}
              <div className={`${styles.panel} ${styles.pMid}`}>
                <div className={`${styles.face} ${styles.front}`}>
                  <span className={styles.ln} style={{ top: "26%", width: "82%" }} />
                  <span className={styles.ln} style={{ top: "46%", width: "88%" }} />
                  <span className={styles.ln} style={{ top: "66%", width: "60%" }} />
                </div>
              </div>

              {/* BOTTOM third — folds up; back is blank paper */}
              <div className={`${styles.panel} ${styles.pBot}`}>
                <div className={`${styles.face} ${styles.front}`}>
                  <span className={styles.ln} style={{ top: "30%", width: "74%" }} />
                  <span className={styles.ln} style={{ top: "54%", width: "40%" }} />
                </div>
                <div className={`${styles.face} ${styles.back}`} />
                <span className={styles.shade} />
              </div>
            </div>

            {/* the crafted golden-ratio envelope — crossfades in as the fold lands, then flies */}
            <EnvelopeMark />

            {/* the live form — the opaque rounded card at rest; settles away on send */}
            <div className={styles.formLayer}>
              <Stamp />
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-name">Name</label>
                    <input className={styles.input} id="cf-name" type="text" placeholder="Your name" required autoComplete="name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-email">Email</label>
                    <input className={styles.input} id="cf-email" type="email" placeholder="you@company.com" required autoComplete="email" />
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-company">Company</label>
                    <input className={styles.input} id="cf-company" type="text" placeholder="Where you work (optional)" autoComplete="organization" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-topic">What&rsquo;s this about?</label>
                    <CustomSelect id="cf-topic" value={topic} onChange={setTopic} options={TOPICS} placeholder="Select a topic" />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cf-message">Message</label>
                  <textarea className={styles.input} id="cf-message" placeholder="Describe what you're working on, what you need, or what you'd like to explore." rows={5} required />
                </div>

                <button type="submit" className={styles.sendBtn} aria-busy={sent}>
                  Send message
                  <Send size={16} strokeWidth={2.2} aria-hidden />
                </button>
              </form>
            </div>
            </div>
          </div>

          {/* success — sibling of the flying mailer; emerges after the fly-away */}
          <div className={styles.success} data-sent={flag} role="status" aria-live="polite" aria-atomic="true">
            {sent && (
              <>
                <span className={styles.successMark}>
                  <Asterisk size={26} strokeWidth={2} aria-hidden />
                </span>
                <h2 className={styles.successTitle}>Message on its way</h2>
                <p className={styles.successSub}>Thanks — we&rsquo;ll be in touch shortly.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
