/**
 * ProductSections — the /product hub's per-product detail: one full section per
 * product (same order as the home page's "What we're building" showcase). Layout
 * follows an Apple-product-page editorial template, held IDENTICAL section to section
 * so four different brand colours read as one family:
 *
 *   eyebrow (accent) → BIG logo lockup (the section's heading) → a large, tight-tracked
 *   one-line statement → capped-measure body prose → a 2×2 capability grid (each cell =
 *   bold title + one supporting line) → an outbound "Visit <product> ↗" link to the
 *   product's OWN site (or a quiet "coming soon" until that site exists).
 *
 * Each product now lives on its own external site; this hub section is its on-site home —
 * the nav menu / home "Explore" links scroll here (id={slug}), and the Visit link hands off
 * to the real site. Only the logo, the section's derived `--accent`, and the copy vary. The
 * accent is derived from the product's raw brand hex via the same relative-oklch shift as the
 * home page's product rows (product.module.css) and is used ONLY on the eyebrow — every other
 * element stays neutral, so the page reads as one coherent system, with the brand colour
 * living in the logo's own mark.
 *
 * Capability copy is authored as `{ title, detail }` pairs (not a bullet phrase) so the
 * grid presents each as a considered feature card rather than a list item.
 */
import type { CSSProperties } from "react";
import DualToneLogo from "@/components/ui/DualToneLogo/DualToneLogo";
import SectionLink from "@/components/ui/SectionLink/SectionLink";
import styles from "./product.module.css";

const rawColor = (v: string) => ({ ["--p-raw"]: v } as CSSProperties);

type Capability = { title: string; detail: string };
type ProductSection = {
  slug: string;
  logo: string;
  /** the logo's viewBox aspect (w/h) — drives equal-optical-area sizing + flush-left fit */
  aspect: number;
  label: string;
  color: string;
  eyebrow: string;
  tagline: string;
  body: readonly string[];
  capabilities: readonly Capability[];
  /** the product's own external site — when set, the section shows a "Visit <product> ↗"
   *  outbound link; until then a muted "coming soon" stands in. */
  url?: string;
};

const PRODUCT_SECTIONS: readonly ProductSection[] = [
  {
    slug: "members",
    logo: "/logos/logo-members.svg",
    aspect: 611 / 125,
    label: "Members",
    color: "#5057FF",
    eyebrow: "Loyalty platform",
    tagline: "A loyalty system each business runs as its own.",
    body: [
      "Most loyalty solutions force a trade-off. Off-the-shelf tools look identical and bend awkwardly around how rewards actually work. Custom builds fit better, but take months and turn small changes into ongoing work. In both cases, the business adapts to the tool instead of the other way around.",
      "This platform gives each business its own loyalty app, opened directly inside LINE — no download, no friction. Branding and operation live in one place. You define how it looks, publish changes instantly, and run the program day to day without relying on developers. The system stays consistent as it evolves, rather than drifting over time.",
    ],
    capabilities: [
      { title: "Brand it yourself", detail: "Define colors, styling, and card design with a live preview." },
      { title: "Run everything in one place", detail: "Points, rewards, missions, and member activity." },
      { title: "Lives where customers already are", detail: "Opens inside LINE — nothing to install." },
      { title: "Built for operation", detail: "Managed day to day, not treated as a project." },
    ],
  },
  {
    slug: "cmission",
    logo: "/logos/logo-cmission.svg",
    aspect: 682 / 67,
    label: "Cmission",
    color: "#FF343B",
    eyebrow: "Mission & task coordination",
    tagline: "Mission and task coordination for teams that move fast.",
    body: [
      "Cmission treats a team's work as a set of missions with a clear owner and a clear outcome, not an open-ended backlog. Tasks exist inside that mission's context instead of floating free, so it's always clear why a piece of work exists and what finishing it actually changes. Decisions and updates stay attached to the work they belong to, so nothing important gets lost in a separate chat history once a mission starts moving fast.",
    ],
    capabilities: [
      { title: "Missions, not backlogs", detail: "Tasks live nested inside the mission they serve." },
      { title: "One clear owner", detail: "Always visible on every mission, never ambiguous." },
      { title: "Context stays put", detail: "Decisions and updates attach to the work, not a side chat." },
      { title: "Built for speed", detail: "For fast-moving teams, not heavyweight process." },
    ],
  },
  {
    slug: "beacon",
    logo: "/logos/logo-beacon.svg",
    aspect: 881 / 222,
    label: "Beacon",
    color: "#FF6592",
    eyebrow: "Signal layer",
    tagline: "A signal layer for teams to find what matters, when it matters.",
    body: [
      "Every team channel eventually drowns in the same noise: updates, mentions, and alerts competing for attention with no way to tell which ones actually matter right now. Beacon sits above those channels as a signal layer, surfacing what needs a person's attention and quietly holding back what doesn't, instead of forwarding every notification at full volume. The goal isn't fewer messages, it's the right ones arriving with the right weight, so urgency stops being something a person has to guess at.",
    ],
    capabilities: [
      { title: "Signal over noise", detail: "Scored across every connected channel." },
      { title: "Surfaces what matters", detail: "Priority rises automatically — no manual triage." },
      { title: "Quiet by default", detail: "Loud only when something genuinely needs you." },
      { title: "Sits above your tools", detail: "A layer over what you already use, not a replacement." },
    ],
  },
  {
    slug: "latent-write",
    logo: "/logos/logo-latent-write.svg",
    aspect: 798 / 74,
    label: "Latent Write",
    color: "#73ADFF",
    eyebrow: "Writing system",
    tagline: "A writing system that thinks in structure, not just words.",
    body: [
      "Most writing tools treat a document as a flat sequence of words, which is fine until an idea gets complicated enough to need real structure underneath it. Latent Write keeps the structure of an argument alongside the prose itself, so a long or technical piece of writing can be reorganised, checked for gaps, and built on without that structure quietly drifting out of sync with the words. Ideas that need to hold their shape over many drafts get to keep it.",
    ],
    capabilities: [
      { title: "Structure with the prose", detail: "Tracked together, not structured then forgotten." },
      { title: "Reorganise freely", detail: "Move an argument without losing the words." },
      { title: "Made for long-form", detail: "Technical, sustained writing — not quick notes." },
      { title: "Catch gaps early", detail: "Inconsistencies surface as you write, not after." },
    ],
  },
];

export default function ProductSections() {
  return (
    <>
      {PRODUCT_SECTIONS.map((p, i) => {
        // equal-area logo sizing: width ∝ √aspect against a shared scale ⇒ every lockup
        // ends with the same bounding-box area (see product.module.css `.productLogo`).
        const logoStyle = {
          ["--logo-ar"]: p.aspect,
          ["--logo-k"]: Math.sqrt(p.aspect),
        } as CSSProperties;
        return (
          <section
            key={p.slug}
            id={p.slug}
            className={`${i % 2 === 1 ? "sectionAlt" : "section"} ${styles.productSection}`}
            style={rawColor(p.color)}
          >
            <div className="container">
              <span className="eyebrow">{p.eyebrow}</span>
              <h2 className={styles.productLogo} style={logoStyle}>
                <DualToneLogo src={p.logo} label={p.label} className={styles.productLogoSvg} />
              </h2>
              <p className={styles.productTagline}>{p.tagline}</p>

              {/* prose + capability grid: stacked by default, side-by-side on wide desktop */}
              <div className={styles.productDetail}>
                <div className={styles.productBody}>
                  {p.body.map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
                </div>
                <ul className={styles.productGrid}>
                  {p.capabilities.map((c) => (
                    <li key={c.title}>
                      <h3 className={styles.cardTitle}>{c.title}</h3>
                      <p className={styles.cardDetail}>{c.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {p.url ? (
                <div className={styles.productCta}>
                  <SectionLink href={p.url} external>
                    Visit {p.label}
                  </SectionLink>
                </div>
              ) : (
                <p className={styles.productStatus}>Website coming soon</p>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
