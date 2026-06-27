"use client";

/**
 * ExportDialog — a professional, print-shop-aware export sheet. A flat floating panel
 * (portal + scrim, no glass) where you choose FORMAT (PDF/PNG/JPG/SVG), SIDES, an OUTPUT
 * layout (trimmed · bleed+marks · imposed print sheet) and RESOLUTION, with a live preview
 * of both faces and a running summary of exactly what will download. Follows the STM flat
 * tool vocabulary: segmented pill groups, considered labels, solid-pill CTA.
 */

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import {
  exportCard,
  sheetCount,
  SHEETS,
  type ExportSpec,
  type ExportFormat,
  type ExportSides,
  type ExportLayout,
  type SheetSize,
} from "./cardExport";
import { CARD_MM, BLEED_MM, type CardModel } from "./cardModel";
import type { FaceAssets } from "./cardFaces";
import styles from "./businessCard.module.css";

// format acronyms + sheet sizes stay Latin (PDF/PNG/JPG/SVG, A4/US Letter) — see i18n rules §3
const FORMATS: { v: ExportFormat; label: string }[] = [
  { v: "pdf", label: "PDF" },
  { v: "png", label: "PNG" },
  { v: "jpg", label: "JPG" },
  { v: "svg", label: "SVG" },
];
const SIDES: ExportSides[] = ["both", "front", "back"];
const LAYOUTS: ExportLayout[] = ["trim", "bleed", "sheet"];
const SHEET_SIZES: { v: SheetSize; label: string }[] = [
  { v: "a4", label: "A4" },
  { v: "letter", label: "US Letter" },
];
const DPIS = [150, 300, 600];

/* a flat segmented pill group (radio semantics) */
function Pills<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { v: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.pillRow} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={o.v === value}
          className={`${styles.pill}${o.v === value ? ` ${styles.pillActive}` : ""}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      {children}
    </div>
  );
}

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export default function ExportDialog({
  open,
  onClose,
  model,
  assets,
  faces,
  spec,
  setSpec,
}: {
  open: boolean;
  onClose: () => void;
  model: CardModel;
  assets: FaceAssets;
  faces: { front: string; back: string };
  spec: ExportSpec;
  setSpec: (s: ExportSpec) => void;
}) {
  const t = useTranslations("businessCard.export");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleId = useId();

  const sideOptions = SIDES.map((v) => ({ v, label: t(`sides.${v}`) }));
  const layoutOptions = LAYOUTS.map((v) => ({ v, label: t(`layouts.${v}.label`) }));

  const set = useCallback(
    <K extends keyof ExportSpec>(key: K, value: ExportSpec[K]) => setSpec({ ...spec, [key]: value }),
    [spec, setSpec],
  );

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await exportCard(spec, model, assets);
      onClose();
    } catch (e) {
      console.error(e);
      setErr(t("error"));
    } finally {
      setBusy(false);
    }
  }, [spec, model, assets, onClose, t]);

  const isRaster = spec.format === "png" || spec.format === "jpg";
  const showDpi = isRaster || spec.format === "pdf";
  const isSheet = spec.layout === "sheet";
  const faceCount = spec.sides === "both" ? 2 : 1;
  const activeHint = t(`layouts.${spec.layout}.hint`);

  const summary = useMemo(() => {
    // format token + numbers + dimensions stay verbatim; only the human WORDS are localized
    const fmt = spec.format.toUpperCase();
    let qty: string;
    if (spec.format === "svg") qty = faceCount === 2 ? t("summary.svgBoth") : t("summary.oneFile");
    else if (isRaster) qty = faceCount === 2 ? t("summary.rasterBoth") : t("summary.oneFile");
    else qty = isSheet ? t("summary.sheets", { count: faceCount }) : t("summary.pages", { count: faceCount });

    let geom: string;
    if (isSheet) geom = `${SHEETS[spec.sheet].label} · ${t("summary.cardsPerSheet", { count: sheetCount(spec.sheet) })}`;
    else if (spec.layout === "bleed") geom = `${CARD_MM.w} × ${CARD_MM.h} mm + ${BLEED_MM} mm ${t("summary.bleedMarks")}`;
    else geom = `${CARD_MM.w} × ${CARD_MM.h} mm`;

    return { line1: `${fmt} · ${qty}`, line2: showDpi ? `${geom} · ${spec.dpi} dpi` : geom };
  }, [spec, faceCount, isRaster, isSheet, showDpi, t]);

  if (!open || typeof document === "undefined") return null;

  const faceThumb = (side: "front" | "back") => (
    <figure
      className={`${styles.previewFace}${spec.sides !== "both" && spec.sides !== side ? ` ${styles.previewDim}` : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={svgUrl(faces[side])} alt={t("faceAlt", { side: t(`sides.${side}`) })} />
      <figcaption>{t(`sides.${side}`)}</figcaption>
    </figure>
  );

  return createPortal(
    <div className={`${styles.scrim} backdrop-blur-[3px]`} onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHead}>
          <div>
            <span className="eyebrow">{t("eyebrow")}</span>
            <h2 id={titleId} className={styles.dialogTitle}>
              {t("title")}
            </h2>
          </div>
          <button type="button" className={styles.dialogClose} onClick={onClose} aria-label={t("close")}>
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.previewRow}>
          {faceThumb("front")}
          {faceThumb("back")}
        </div>

        <div className={styles.groups}>
          <Group label={t("groups.format")}>
            <Pills label={t("aria.format")} value={spec.format} options={FORMATS} onChange={(v) => set("format", v)} />
          </Group>

          <Group label={t("groups.sides")}>
            <Pills label={t("aria.sides")} value={spec.sides} options={sideOptions} onChange={(v) => set("sides", v)} />
          </Group>

          <Group label={t("groups.output")}>
            <Pills label={t("aria.output")} value={spec.layout} options={layoutOptions} onChange={(v) => set("layout", v)} />
            <p className={styles.groupHint}>{activeHint}</p>
            {isSheet && (
              <Pills label={t("aria.sheet")} value={spec.sheet} options={SHEET_SIZES} onChange={(v) => set("sheet", v)} />
            )}
          </Group>

          {showDpi && (
            <Group label={t("groups.resolution")}>
              <Pills
                label={t("aria.resolution")}
                value={spec.dpi}
                options={DPIS.map((d) => ({ v: d, label: `${d} dpi` }))}
                onChange={(v) => set("dpi", v)}
              />
            </Group>
          )}
        </div>

        {err && <p className={styles.dialogErr}>{err}</p>}

        <footer className={styles.dialogFoot}>
          <div className={styles.summary}>
            <span className={styles.summaryStrong}>{summary.line1}</span>
            <span className={styles.summaryFaint}>{summary.line2}</span>
          </div>
          <div className={styles.footBtns}>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>
              {t("cancel")}
            </button>
            <button type="button" className={styles.btnPrimary} onClick={run} disabled={busy}>
              {busy ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Download size={16} aria-hidden />}
              {t("export")}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
