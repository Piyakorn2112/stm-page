"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import type { CardModel } from "./cardModel";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import styles from "./businessCard.module.css";

const FIELDS: { key: keyof CardModel; type?: string; wide?: boolean }[] = [
  { key: "name", wide: true },
  { key: "title" },
  { key: "tel" },
  { key: "email", type: "email", wide: true },
];

export default function EditPanel({
  model,
  onChange,
  onExport,
}: {
  model: CardModel;
  onChange: (key: keyof CardModel, value: string) => void;
  onExport: () => void;
}) {
  const t = useTranslations("businessCard.form");
  return (
    <div className={styles.details}>
      <div className={styles.detailsHead}>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h2 className={styles.detailsTitle}>{t("title")}</h2>
        <p className={styles.detailsSub}>{t("sub")}</p>
      </div>

      <div className={styles.fields}>
        {FIELDS.map((field) => (
          <label key={field.key} className={`${styles.field}${field.wide ? ` ${styles.fieldWide}` : ""}`}>
            <span className={styles.fieldLabel}>{t(`fields.${field.key}.label`)}</span>
            <input
              className={styles.input}
              type={field.type ?? "text"}
              value={model[field.key]}
              placeholder={t(`fields.${field.key}.placeholder`)}
              onChange={(e) => onChange(field.key, e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} onClick={onExport}>
          <Download size={16} aria-hidden />
          {t("export")}
        </button>
      </div>
      <p className={styles.dims}>{t("caption")}</p>
      <LocaleReadLink />
    </div>
  );
}
