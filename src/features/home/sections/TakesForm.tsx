/**
 * TakesForm — "Where it takes form": a vertical soft-body channel (FlowField) beside the
 * copy; one ring at a time morphs circle → twisted STM form as it flows up the column.
 */
import { useTranslations } from "next-intl";
import { Boxes, Fingerprint, Zap } from "lucide-react";
import FlowField from "@/components/graphic/FlowField/FlowField";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

const PILLARS = [
  { key: "identity", Icon: Fingerprint },
  { key: "product", Icon: Boxes },
  { key: "interaction", Icon: Zap },
] as const;

export function TakesForm() {
  const t = useTranslations("home.takesForm");
  return (
    <section id="form" className={"section"} style={accent("var(--blue)")}>
      <div className={`container ${styles.formSplit}`}>
        <div className={styles.formFlow}>
          <FlowField className={styles.formFlowCanvas} />
        </div>
        <div className={styles.formText}>
          <span className={"eyebrow"}>{t("eyebrow")}</span>
          <h2 className={"heading"}>
            {t.rich("heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <p className={"lede"}>{t("lede")}</p>
          <p className={"body"}>{t("body")}</p>
          <div className={styles.formPillars}>
            {PILLARS.map(({ Icon, key }) => (
              <div key={key} className={styles.formPillar}>
                <Icon className={styles.formPillarIcon} size={20} strokeWidth={2.2} aria-hidden />
                <div>
                  <p className={styles.formPillarTitle}>{t(`pillars.${key}.title`)}</p>
                  <p className={styles.formPillarDesc}>{t(`pillars.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
          <LocaleReadLink />
        </div>
      </div>
    </section>
  );
}
