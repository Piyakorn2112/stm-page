/**
 * ProductPage — the /product hub: shared nav + an oversized animated brand-ring hero
 * ("Explore our products"), then one detail section per product (ProductSections) +
 * footer.
 */
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import CtaSection from "@/components/ui/CtaSection/CtaSection";
import ProductHero from "./ProductHero";
import ProductSections from "./ProductSections";
import { productNavConfig } from "./nav.config";
import styles from "./product.module.css";

export default function ProductPage() {
  return (
    <div className={styles.page}>
      <Nav config={productNavConfig} />
      <main>
        <ProductHero />
        <ProductSections />
        <CtaSection
          title="Interested in our products?"
          body="Reach out to learn about availability, how a product fits your team, or to start a conversation about what you're building."
        />
      </main>
      <Footer />
    </div>
  );
}
