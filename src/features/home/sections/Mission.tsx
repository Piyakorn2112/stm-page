/**
 * Mission — graphic LEFT (the three brand soft-bodies pressing into one), text RIGHT
 * and smaller; both stack and centre on mobile. The graphic only animates once it
 * scrolls into view (see SoftRingsField), so it never competes with the hero.
 */
import { useTranslations } from "next-intl";
import SoftRingsField from "@/components/graphic/SoftRingsField/SoftRingsField";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import styles from "@/features/home/home.module.css";

export function Mission() {
  const t = useTranslations("home.mission");
  return (
    <section id="about" className={"section"}>
      <div className={`container ${styles.missionSplit}`}>
        <div className={styles.missionVisual}>
          <SoftRingsField />
        </div>
        <div className={styles.missionText}>
          <h2 className={styles.missionHeading}>
            {t.rich("heading", {
              creativity: (c) => (
                <em className={"accentWord"} style={{ color: "var(--orange)" }}>
                  {c}
                </em>
              ),
              engineering: (c) => (
                <em className={"accentWord"} style={{ color: "var(--blue)" }}>
                  {c}
                </em>
              ),
              intelligence: (c) => (
                <em className={"accentWord"} style={{ color: "var(--indigo)" }}>
                  {c}
                </em>
              ),
            })}
          </h2>
          <p className={styles.missionLede}>{t("lede")}</p>
          <LocaleReadLink />
        </div>
      </div>
    </section>
  );
}
