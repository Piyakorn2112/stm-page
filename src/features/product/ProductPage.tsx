/**
 * ProductPage — the /product hub: shared nav + an oversized animated brand-ring hero
 * ("Explore our products"), then one detail section per product (ProductSections) +
 * footer.
 */
import { useTranslations } from "next-intl";
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import CtaSection from "@/components/ui/CtaSection/CtaSection";
import ProductHero from "./ProductHero";
import ProductSections from "./ProductSections";
import { productNavConfig } from "./nav.config";
import styles from "./product.module.css";

export default function ProductPage() {
  const t = useTranslations("product");
  const tNav = useTranslations("nav");
  return (
    <div className={styles.page}>
      <Nav config={productNavConfig} />
      <main>
        <ProductHero />
        <ProductSections />
        <CtaSection
          title={t("cta.title")}
          body={t("cta.body")}
          ctaLabel={tNav("contact")}
        />
      </main>
      <Footer />
    </div>
  );
}
