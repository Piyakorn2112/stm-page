"use client";

import { Download, Loader2 } from "lucide-react";
import type { CardModel } from "./cardModel";
import styles from "./businessCard.module.css";

const FIELDS: { key: keyof CardModel; label: string; type?: string; placeholder: string; wide?: boolean }[] = [
  { key: "name", label: "Name", placeholder: "Full name", wide: true },
  { key: "title", label: "Role", placeholder: "Your role" },
  { key: "tel", label: "Phone", placeholder: "000 000 0000" },
  { key: "email", label: "Email", type: "email", placeholder: "you@email.com", wide: true },
  { key: "url", label: "Website", placeholder: "yoursite.com" },
];

export default function EditPanel({
  model,
  onChange,
  accentHex,
  accentName,
  onExportSvg,
  onExportPdf,
  busy,
}: {
  model: CardModel;
  onChange: (key: keyof CardModel, value: string) => void;
  accentHex: string;
  accentName: string;
  onExportSvg: () => void;
  onExportPdf: () => void;
  busy: boolean;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Your details</h2>
        <span className={styles.accentChip}>
          <span className={styles.accentDot} style={{ background: accentHex }} aria-hidden />
          {accentName}
        </span>
      </div>

      <div className={styles.fields}>
        {FIELDS.map((field) => (
          <label key={field.key} className={`${styles.field}${field.wide ? ` ${styles.fieldWide}` : ""}`}>
            <span className={styles.fieldLabel}>{field.label}</span>
            <input
              className={styles.input}
              type={field.type ?? "text"}
              value={model[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.key, e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} onClick={onExportPdf} disabled={busy}>
          {busy ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Download size={16} aria-hidden />}
          Print-ready PDF
        </button>
        <button type="button" className={styles.btnGhost} onClick={onExportSvg} disabled={busy}>
          <Download size={16} aria-hidden />
          SVG
        </button>
        <span className={styles.dims}>90 × 54 mm · 3 mm bleed</span>
      </div>
    </section>
  );
}
