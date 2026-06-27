/**
 * Footer — shared site footer (brand + nav columns). Kept out of page content so layout
 * and content stay separate. Uses the site primitives stylesheet. A faint, greyscale,
 * worker-driven ring matrix (FooterMatrix) sits behind the content as the backdrop.
 *
 * Links use the locale-aware next-intl Link so the active locale (/, /th) is preserved,
 * and absolute paths (/#anchor) so anchors work correctly from any page.
 */
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import FooterMatrix from "@/components/graphic/FooterMatrix/FooterMatrix";
import StmLogo from "@/components/graphic/StmLogo/StmLogo";
import styles from "./styles.module.css";

export default function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className={styles.footer}>
      <FooterMatrix className={styles.matrix} />
      <div className={`container ${styles.footerInner}`}>
        <div>
          <Link className={styles.footerBrand} href="/" aria-label="Srang Tech Mai, home">
            <StmLogo width={300} />
          </Link>
          <p className={styles.footerTag}>{t("tagline")}</p>
        </div>
        <div className={styles.footerCols}>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>{t("company")}</span>
            <Link href="/#about">{t("about")}</Link>
            <Link href="/#philosophy">{t("philosophy")}</Link>
            <Link href="/work">{t("howWeWork")}</Link>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>{t("products")}</span>
            <Link href="/product#members">Members</Link>
            <Link href="/product#cmission">Cmission</Link>
            <Link href="/product#beacon">Beacon</Link>
            <Link href="/product#latent-write">Latent Write</Link>
            <Link href="/product">{t("viewAll")}</Link>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColHead}>{t("contact")}</span>
            <Link href="/contact">{t("getInTouch")}</Link>
          </div>
        </div>
      </div>
      <div className={`container ${styles.footerBottom}`}>
        <p className={styles.footerNote}>
          {t("rights", { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </footer>
  );
}
