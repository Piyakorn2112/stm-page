/**
 * ProductPage — minimal placeholder: the shared nav + footer with a centred "Product"
 * heading in between. Intentionally bare for now; real product content lands later.
 */
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import { productNavConfig } from "./nav.config";
import styles from "./product.module.css";

export default function ProductPage() {
  return (
    <div className={styles.page}>
      <Nav config={productNavConfig} />
      <main className={styles.hero}>
        <div>
          <h1 className={styles.title}>Product</h1>
          <p className={styles.note}>Coming soon</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
