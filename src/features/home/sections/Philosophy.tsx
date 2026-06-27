/**
 * Philosophy — a full-bleed ring-environment (ArcField) behind the copy: the ring
 * breathes in the open space and product icons continuously bubble out of it. The text
 * carries a reserve hitbox (data-arc-reserve) so icons never slide under it.
 */
import { useTranslations } from "next-intl";
import ArcField from "@/components/graphic/ArcField/ArcField";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import styles from "@/features/home/home.module.css";

export function Philosophy() {
  const t = useTranslations("home.philosophy");
  return (
    <section id="philosophy" className={`section sectionAlt ${styles.philFull}`}>
      <ArcField className={styles.philArcBg} />
      <div className={"container"}>
        <div className={`${styles.philText}`} data-arc-reserve>
          <span className={"eyebrow"}>{t("eyebrow")}</span>
          <h2 className={styles.missionHeading}>
            {t.rich("heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <p className={styles.missionLede}>{t("lede")}</p>
          <LocaleReadLink />
        </div>
      </div>
    </section>
  );
}
