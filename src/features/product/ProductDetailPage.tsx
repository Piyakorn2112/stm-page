/**
 * ProductDetailPage — minimal placeholder for an individual product (/products/<slug>).
 * Same shape as the /product overview: shared nav + footer + a centred name. Real content later.
 */
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import { productNavConfig } from "./nav.config";
import styles from "./product.module.css";

export default function ProductDetailPage({ name }: { name: string }) {
  return (
    <div className={styles.page}>
      <Nav config={productNavConfig} />
      <main className={styles.hero}>
        <div>
          <h1 className={styles.title}>{name}</h1>
          <p className={styles.note}>Coming soon</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
