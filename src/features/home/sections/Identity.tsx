/**
 * Identity — "Systems of people, not roles": copy on the LEFT, the employee ring grid
 * (IdentityGrid) on the RIGHT; the grid moves on top of the copy on mobile.
 */
import { useTranslations } from "next-intl";
import IdentityGrid from "@/components/graphic/IdentityGrid/IdentityGrid";
import SectionLink from "@/components/ui/SectionLink/SectionLink";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

export function Identity() {
  const t = useTranslations("home.identity");
  return (
    <section id="identity" className={`section sectionAlt`} style={accent("var(--orange)")}>
      <div className={`container ${styles.idSplit}`}>
        <div className={styles.idText}>
          <span className={"eyebrow"}>{t("eyebrow")}</span>
          <h2 className={"heading"}>
            {t.rich("heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <p className={"lede"}>{t("lede")}</p>
          <p className={"body"}>{t("body")}</p>
          <SectionLink href="/work">{t("link")}</SectionLink>
          <LocaleReadLink />
        </div>
        <div className={styles.idGridWrap}>
          <IdentityGrid />
        </div>
      </div>
    </section>
  );
}
