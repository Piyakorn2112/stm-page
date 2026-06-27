/**
 * Products — "What we're building": a plain black header (no per-section accent colour;
 * unlike every other section, this one hosts several products with their OWN brand
 * colours, so the header stays neutral and the colour lives in each row's text instead).
 * Below it, a zigzag list of showcase rows: a cover image on one side, plain text on the
 * other (product name + description + an "Explore" link), alternating sides row to row.
 *
 * Product NAMES stay in Latin (brand names — see docs/i18n/thai-localization.md); only the
 * descriptions + the "Explore" link are localized.
 *
 * Each row carries its product's raw brand hex via `--p-raw`; the visible `--accent` is
 * DERIVED from it in CSS (home.module.css) via a relative oklch lightness/chroma shift.
 */
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { PRODUCTS, productAnchor } from "@/components/ui/Nav/navLinks";
import SectionLink from "@/components/ui/SectionLink/SectionLink";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

const rawColor = (v: string) => ({ ["--p-raw"]: v } as CSSProperties);

const SHOWCASE = [
  { slug: "members", cover: "/product-covers/cover-members.svg", color: "#5057FF" },
  { slug: "cmission", cover: "/product-covers/cover-cmission.svg", color: "#FF343B" },
  { slug: "beacon", cover: "/product-covers/cover-beacon.svg", color: "#FF6592" },
  { slug: "latent-write", cover: "/product-covers/cover-latentwrite.svg", color: "#73ADFF" },
] as const;

export function Products() {
  const t = useTranslations("home.products");
  return (
    <section id="products" className={"section"} style={accent("var(--fg)")}>
      <div className={"container"}>
        <span className={"eyebrow"}>{t("eyebrow")}</span>
        <h2 className={"heading"}>{t("heading")}</h2>
        <p className={"lede"}>{t("lede")}</p>
        <SectionLink href="/product">{t("viewAll")}</SectionLink>
        <div className={styles.productList}>
          {SHOWCASE.map(({ slug, cover, color }, i) => {
            const label = PRODUCTS.find((p) => p.slug === slug)?.label ?? slug;
            const image = (
              <div className={styles.productImage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt={`${label} product cover`} />
              </div>
            );
            const text = (
              <div className={styles.productText} style={rawColor(color)}>
                <h3 className={styles.productName}>{label}</h3>
                <p className={styles.productDesc}>{t(`items.${slug}`)}</p>
                <SectionLink href={productAnchor(slug)}>{t("explore", { name: label })}</SectionLink>
              </div>
            );
            return (
              <div key={slug} className={styles.productRow}>
                {i % 2 === 0 ? (
                  <>
                    {image}
                    {text}
                  </>
                ) : (
                  <>
                    {text}
                    {image}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <LocaleReadLink />
      </div>
    </section>
  );
}
