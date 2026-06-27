/**
 * WorkContent — the "How We Work" page body, below the interactive badge hero.
 * Reads as the system behind the people who build STM: opening statement → how we
 * operate → aligned-not-isolated (with the structural diagram) → who fits / who
 * doesn't → closing. Reuses the site's editorial language (eyebrow / heading /
 * accentWord / lede / body) so it sits in the same "museum flow" as the homepage;
 * each section carries its OWN accent (indigo / blue / orange), used sparingly.
 */

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Blend, Boxes, Check, Gem, Hand, Minus, Network, Palette, PackageOpen, Users } from "lucide-react";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import styles from "@/features/build/build.module.css";
import AlignmentDiagram from "./AlignmentDiagram";
import TeamField from "@/components/graphic/TeamField/TeamField";

const accent = (v: string) => ({ ["--accent"]: v } as CSSProperties);

const PRINCIPLES = [Blend, Users, PackageOpen, Hand, Gem];
const PRINCIPLE_KEYS = ["multidisciplinary", "smallTeams", "outcome", "ownership", "craft"] as const;

const ALIGN = [Palette, Boxes, Network];
const ALIGN_KEYS = ["design", "engineering", "system"] as const;

const FIT_KEYS = ["acrossDisciplines", "lookAndWork", "ownership", "figureOut", "refine"] as const;
const NOT_FIT_KEYS = ["definedRoles", "stepByStep", "separateWork", "speedOverQuality"] as const;

export default function WorkContent() {
  const t = useTranslations("work");
  return (
    <>
      {/* Opening statement — indigo */}
      <section className={"section"} style={accent("var(--indigo)")}>
        <div className={`container ${styles.workCenter}`}>
          <span className={"eyebrow"}>{t("opening.eyebrow")}</span>
          <h2 className={"heading"}>
            {t.rich("opening.heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <p className={"lede"}>{t("opening.lede")}</p>
          <p className={"body"}>{t("opening.body")}</p>
          <LocaleReadLink />
        </div>
      </section>

      {/* How we operate — orange */}
      <section className={`section sectionAlt`} style={accent("var(--orange)")}>
        <div className={"container"}>
          <span className={"eyebrow"}>{t("operate.eyebrow")}</span>
          <h2 className={"heading"}>
            {t.rich("operate.heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <div className={styles.principles}>
            {PRINCIPLES.map((Icon, i) => {
              const key = PRINCIPLE_KEYS[i];
              return (
                <div key={key} className={styles.principle}>
                  <div className={styles.principleIconWrap}>
                    <Icon className={styles.principleIcon} size={20} strokeWidth={2.3} aria-hidden />
                  </div>
                  <h3 className={styles.principleTitle}>{t(`operate.principles.${key}.title`)}</h3>
                  <p className={styles.principleDesc}>{t(`operate.principles.${key}.desc`)}</p>
                </div>
              );
            })}
          </div>
          <LocaleReadLink />
        </div>
      </section>

      {/* Aligned, not isolated — blue (structure, matching the homepage) */}
      <section className={"section"} style={accent("var(--blue)")}>
        <div className={`container ${styles.alignSplit}`}>
          <div className={styles.alignVisual}>
            <TeamField className={styles.teamField} />
          </div>
          <div className={styles.alignText}>
            <span className={"eyebrow"}>{t("align.eyebrow")}</span>
            <h2 className={"heading"}>
              {t.rich("align.heading", {
                accent: (c) => <em className={"accentWord"}>{c}</em>,
              })}
            </h2>
            <p className={"lede"}>{t("align.lede")}</p>
            <p className={"body"}>{t("align.body")}</p>
            <ul className={styles.alignList}>
              {ALIGN.map((Icon, i) => {
                const key = ALIGN_KEYS[i];
                return (
                  <li key={key} className={styles.alignItem}>
                    <Icon className={styles.alignIcon} size={21} strokeWidth={2.3} aria-hidden />
                    <span className={styles.alignBody}>
                      <span className={styles.alignItemT}>{t(`align.items.${key}.title`)}</span>
                      <span className={styles.alignItemD}>{t(`align.items.${key}.desc`)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <AlignmentDiagram className={styles.alignDiagramInline} />
            <p className={"body"}>{t("align.closing")}</p>
            <LocaleReadLink />
          </div>
        </div>
      </section>

      {/* Who fits / who doesn't — indigo */}
      <section className={`section sectionAlt`} style={accent("var(--indigo)")}>
        <div className={"container"}>
          <span className={"eyebrow"}>{t("fit.eyebrow")}</span>
          <h2 className={"heading"}>
            {t.rich("fit.heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <div className={styles.fitCols}>
            <div className={styles.fitCol}>
              <h3 className={styles.fitHead}>{t("fit.fitsHead")}</h3>
              <ul className={styles.fitList}>
                {FIT_KEYS.map((key) => (
                  <li key={key} className={styles.fitItem}>
                    <Check className={styles.fitIcon} size={18} strokeWidth={2.6} aria-hidden />
                    <span>{t(`fit.fits.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${styles.fitCol} ${styles.fitColMuted}`}>
              <h3 className={styles.fitHead}>{t("fit.notFitsHead")}</h3>
              <ul className={styles.fitList}>
                {NOT_FIT_KEYS.map((key) => (
                  <li key={key} className={styles.fitItemMuted}>
                    <Minus className={styles.fitIcon} size={18} strokeWidth={2.6} aria-hidden />
                    <span>{t(`fit.notFits.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <LocaleReadLink />
        </div>
      </section>

      {/* Closing — orange */}
      <section className={"section"} style={accent("var(--orange)")}>
        <div className={`container ${styles.workCenter}`}>
          <span className={"eyebrow"}>{t("closing.eyebrow")}</span>
          <h2 className={"heading"}>
            {t.rich("closing.heading", {
              accent: (c) => <em className={"accentWord"}>{c}</em>,
            })}
          </h2>
          <p className={"lede"}>{t("closing.lede")}</p>
          <LocaleReadLink />
        </div>
      </section>
    </>
  );
}
