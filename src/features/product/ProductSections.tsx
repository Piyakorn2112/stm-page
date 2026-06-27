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
import { useTranslations } from "next-intl";
import DualToneLogo from "@/components/ui/DualToneLogo/DualToneLogo";
import SectionLink from "@/components/ui/SectionLink/SectionLink";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import styles from "./product.module.css";

const rawColor = (v: string) => ({ ["--p-raw"]: v } as CSSProperties);

type ProductSection = {
  slug: string;
  logo: string;
  /** the logo's viewBox aspect (w/h) — drives equal-optical-area sizing + flush-left fit */
  aspect: number;
  /** product NAME — stays Latin (brand name), not localized */
  label: string;
  color: string;
  /** number of body paragraphs (copy lives in the `product` message namespace) */
  paras: number;
  /** number of capability cards (copy lives in the `product` message namespace) */
  caps: number;
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
    paras: 2,
    caps: 4,
  },
  {
    slug: "cmission",
    logo: "/logos/logo-cmission.svg",
    aspect: 682 / 67,
    label: "Cmission",
    color: "#FF343B",
    paras: 1,
    caps: 4,
  },
  {
    slug: "beacon",
    logo: "/logos/logo-beacon.svg",
    aspect: 881 / 222,
    label: "Beacon",
    color: "#FF6592",
    paras: 1,
    caps: 4,
  },
  {
    slug: "latent-write",
    logo: "/logos/logo-latent-write.svg",
    aspect: 798 / 74,
    label: "Latent Write",
    color: "#73ADFF",
    paras: 1,
    caps: 4,
  },
];

export default function ProductSections() {
  const t = useTranslations("product");
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
              <span className="eyebrow">{t(`sections.${p.slug}.eyebrow`)}</span>
              <h2 className={styles.productLogo} style={logoStyle}>
                <DualToneLogo src={p.logo} label={p.label} className={styles.productLogoSvg} />
              </h2>
              <p className={styles.productTagline}>{t(`sections.${p.slug}.tagline`)}</p>

              {/* prose + capability grid: stacked by default, side-by-side on wide desktop */}
              <div className={styles.productDetail}>
                <div className={styles.productBody}>
                  {Array.from({ length: p.paras }, (_, j) => (
                    <p key={j}>{t(`sections.${p.slug}.body.${j}`)}</p>
                  ))}
                </div>
                <ul className={styles.productGrid}>
                  {Array.from({ length: p.caps }, (_, j) => (
                    <li key={j}>
                      <h3 className={styles.cardTitle}>{t(`sections.${p.slug}.capabilities.${j}.title`)}</h3>
                      <p className={styles.cardDetail}>{t(`sections.${p.slug}.capabilities.${j}.detail`)}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {p.url ? (
                <div className={styles.productCta}>
                  <SectionLink href={p.url} external>
                    {t("sections.visit", { name: p.label })}
                  </SectionLink>
                </div>
              ) : (
                <p className={styles.productStatus}>{t("sections.comingSoon")}</p>
              )}
              <LocaleReadLink />
            </div>
          </section>
        );
      })}
    </>
  );
}
