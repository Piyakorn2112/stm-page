/**
 * Footer — shared site footer (brand + nav columns). Kept out of page content so layout
 * and content stay separate. Uses the site primitives stylesheet. A faint, greyscale,
 * worker-driven ring matrix (FooterMatrix) sits behind the content as the backdrop.
 */
import FooterMatrix from "@/components/graphic/FooterMatrix/FooterMatrix";
import styles from "./styles.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <FooterMatrix className={styles.matrix} />
      <div className={`container ${styles.footerInner}`}>
        <div>
          <a className={styles.footerBrand} href="#top" aria-label="Srang Tech Mai — home">
            <span className={styles.footerMark} aria-hidden="true" />
          </a>
          <p className={styles.footerTag}>Structure for what&rsquo;s next.</p>
        </div>
        <div className={styles.footerCols}>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Company</span>
            <a href="#about">About</a>
            <a href="#philosophy">Philosophy</a>
            <a href="#form">Where it takes form</a>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>System</span>
            <a href="#identity">Identity</a>
            <a href="/build">How We Work</a>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Contact</span>
            <a href="/contact">Get in touch</a>
          </div>
        </div>
      </div>
      <div className={`container ${styles.footerBottom}`}>
        <p className={styles.footerNote}>© {new Date().getFullYear()} Srang Tech Mai. Structure for what&rsquo;s next.</p>
      </div>
    </footer>
  );
}
