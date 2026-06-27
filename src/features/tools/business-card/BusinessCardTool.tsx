"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DEFAULT_MODEL, accentHexForSeed, type CardModel } from "./cardModel";
import { buildFaces } from "./cardFaces";
import { DEFAULT_SPEC, type ExportSpec } from "./cardExport";
import { useWordmark } from "./useWordmark";
import { useEmbeddedFont } from "./useEmbeddedFont";
import { accent } from "@/utils/accent";
import EditPanel from "./EditPanel";
import ExportDialog from "./ExportDialog";
import BusinessCard3D from "@/components/graphic/BusinessCard3D/BusinessCard3D";
import RingGrid from "@/components/graphic/RingGrid/RingGrid";
import HeroScrollIndicator from "@/components/ui/HeroScrollIndicator/HeroScrollIndicator";
import styles from "./businessCard.module.css";

// the ring picker is an infinite honeycomb; col 0 rests on the branded default ring
const seedFor = (col: number, row: number) =>
  col === 0 && row === 0 ? "srang-tech-mai" : `bc${col},${row}`;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function BusinessCardTool() {
  const t = useTranslations("businessCard.hero");
  const [model, setModel] = useState<CardModel>(DEFAULT_MODEL);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSpec, setExportSpec] = useState<ExportSpec>(DEFAULT_SPEC);
  const wordmark = useWordmark();
  const fontCss = useEmbeddedFont();
  const assets = useMemo(() => ({ wordmark, fontCss }), [wordmark, fontCss]);

  // the 3D texture rebuild rasterises the high-res rings; debounce so picking stays smooth
  const debouncedModel = useDebounced(model, 160);
  const faces = useMemo(() => buildFaces(debouncedModel, assets), [debouncedModel, assets]);

  const selectRing = useCallback((seed: string) => setModel((m) => ({ ...m, seed })), []);
  const onChange = useCallback(
    (key: keyof CardModel, value: string) => setModel((m) => ({ ...m, [key]: value })),
    [],
  );
  const openExport = useCallback(() => setExportOpen(true), []);
  const closeExport = useCallback(() => setExportOpen(false), []);

  // the chosen ring's brand colour — threaded through the whole page as the live --accent
  const accentHex = accentHexForSeed(model.seed);

  return (
    <div className={styles.tool} style={accent(accentHex)}>
      {/* HERO — the business card in the /work studio environment, filling the viewport */}
      <section className={styles.hero} aria-label={t("ariaLabel")}>
        <div className={styles.scene}>
          <BusinessCard3D frontSvg={faces.front} backSvg={faces.back} />
        </div>

        <header className={styles.heroHead}>
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1 className={styles.title}>
            {t.rich("title", {
              accent: (c) => <em className="accentWord">{c}</em>,
            })}
          </h1>
        </header>

        {/* the ring selector — a SMALL Apple-Watch cluster floating in-scene (no container):
            centre-right on desktop, bottom-centre on mobile. Tap a ring to recolour the card. */}
        <div className={styles.selector}>
          <RingGrid
            layout="orb"
            seedFor={seedFor}
            colorFor={accentHexForSeed}
            selectedSeed={model.seed}
            onSelect={selectRing}
          />
        </div>

        <HeroScrollIndicator variant="blend" />
      </section>

      {/* FORM — refined, flat details + export */}
      <section className={styles.formSection}>
        <EditPanel model={model} onChange={onChange} onExport={openExport} />
      </section>

      <ExportDialog
        open={exportOpen}
        onClose={closeExport}
        model={model}
        assets={assets}
        faces={faces}
        spec={exportSpec}
        setSpec={setExportSpec}
      />
    </div>
  );
}
