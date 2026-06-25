/**
 * ProductPage — the /product landing: shared nav + an oversized animated brand-ring
 * hero ("Explore our products") + footer. Real product content lands below later.
 */
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import ProductHero from "./ProductHero";
import { productNavConfig } from "./nav.config";
import styles from "./product.module.css";

export default function ProductPage() {
  return (
    <div className={styles.page}>
      <Nav config={productNavConfig} />
      <main>
        <ProductHero />
      </main>
      <Footer />
    </div>
  );
}
