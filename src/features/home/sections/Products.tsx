/**
 * Products — "What we're building": a plain black header (no per-section accent colour;
 * unlike every other section, this one hosts several products with their OWN brand
 * colours, so the header stays neutral and the colour lives in each row's text instead).
 * Below it, a zigzag list of showcase rows: a cover image on one side, plain text on the
 * other (product name + description + an "Explore" link, same device as the home page's
 * other section links), alternating sides row to row.
 *
 * Each row carries its product's raw brand hex via `--p-raw`; the visible `--accent` is
 * DERIVED from it in CSS (home.module.css) via a relative oklch lightness/chroma shift,
 * not used raw — light mode darkens it, dark mode lightens + slightly desaturates it,
 * by the same perceptual amount for every hex regardless of how light/saturated it
 * starts out. `.productName` and the row's `SectionLink` both read that one derived
 * `--accent`, so the name and its "Explore" link always match.
 */
import type { CSSProperties } from "react";
import { PRODUCTS, productAnchor } from "@/components/ui/Nav/navLinks";
import SectionLink from "@/components/ui/SectionLink/SectionLink";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

const rawColor = (v: string) => ({ ["--p-raw"]: v } as CSSProperties);

const SHOWCASE = [
  {
    slug: "members",
    cover: "/product-covers/cover-members.svg",
    color: "#5057FF",
    desc: "A membership system for communities that want real structure. Identity, access, and belonging, in one coherent product.",
  },
  {
    slug: "cmission",
    cover: "/product-covers/cover-cmission.svg",
    color: "#FF343B",
    desc: "Mission and task coordination for teams that move fast. Clear ownership, clear outcomes, no lost threads.",
  },
  {
    slug: "beacon",
    cover: "/product-covers/cover-beacon.svg",
    color: "#FF6592",
    desc: "A signal layer for teams to find what matters, when it matters. Built for clarity under noise.",
  },
  {
    slug: "latent-write",
    cover: "/product-covers/cover-latentwrite.svg",
    color: "#73ADFF",
    desc: "A writing system that thinks in structure, not just words. For ideas that need to hold their shape.",
  },
] as const;

export function Products() {
  return (
    <section id="products" className={"section"} style={accent("var(--fg)")}>
      <div className={"container"}>
        <span className={"eyebrow"}>Products</span>
        <h2 className={"heading"}>What we&rsquo;re building.</h2>
        <p className={"lede"}>
          A small, growing set of products. Each one built the same way: structure first,
          then form.
        </p>
        <SectionLink href="/product">View all products</SectionLink>
        <div className={styles.productList}>
          {SHOWCASE.map(({ slug, cover, color, desc }, i) => {
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
                <p className={styles.productDesc}>{desc}</p>
                <SectionLink href={productAnchor(slug)}>Explore {label}</SectionLink>
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
      </div>
    </section>
  );
}
