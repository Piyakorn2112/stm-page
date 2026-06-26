/**
 * Footer — shared site footer (brand + nav columns). Kept out of page content so layout
 * and content stay separate. Uses the site primitives stylesheet. A faint, greyscale,
 * worker-driven ring matrix (FooterMatrix) sits behind the content as the backdrop.
 *
 * Anchor links use absolute paths (/#anchor) so they work correctly from any page, not
 * just the home page.
 */
import Link from "next/link";
import FooterMatrix from "@/components/graphic/FooterMatrix/FooterMatrix";
import StmLogo from "@/components/graphic/StmLogo/StmLogo";
import styles from "./styles.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <FooterMatrix className={styles.matrix} />
      <div className={`container ${styles.footerInner}`}>
        <div>
          <Link className={styles.footerBrand} href="/" aria-label="Srang Tech Mai, home">
            <StmLogo width={300} />
          </Link>
          <p className={styles.footerTag}>Structure for what&rsquo;s next.</p>
        </div>
        <div className={styles.footerCols}>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Company</span>
            <Link href="/#about">About</Link>
            <Link href="/#philosophy">Philosophy</Link>
            <Link href="/work">How We Work</Link>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Products</span>
            <Link href="/product#members">Members</Link>
            <Link href="/product#cmission">Cmission</Link>
            <Link href="/product#beacon">Beacon</Link>
            <Link href="/product#latent-write">Latent Write</Link>
            <Link href="/product">View all</Link>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>Contact</span>
            <Link href="/contact">Get in touch</Link>
          </div>
        </div>
      </div>
      <div className={`container ${styles.footerBottom}`}>
        <p className={styles.footerNote}>© {new Date().getFullYear()} Srang Tech Mai. Structure for what&rsquo;s next.</p>
      </div>
    </footer>
  );
}
