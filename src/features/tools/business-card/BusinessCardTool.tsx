"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MODEL,
  accentHexForSeed,
  accentNameForSeed,
  type CardModel,
} from "./cardModel";
import { buildFaces } from "./cardFaces";
import { downloadSVG, downloadPDF } from "./cardExport";
import { useWordmark } from "./useWordmark";
import { useEmbeddedFont } from "./useEmbeddedFont";
import EditPanel from "./EditPanel";
import BusinessCard3D from "@/components/graphic/BusinessCard3D/BusinessCard3D";
import RingGrid from "@/components/graphic/RingGrid/RingGrid";
import styles from "./businessCard.module.css";

// deterministic seed per grid lattice cell → an effectively infinite field of rings
const seedFor = (col: number, row: number) => `bc${col},${row}`;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function BusinessCardTool() {
  const [model, setModel] = useState<CardModel>(DEFAULT_MODEL);
  const [busy, setBusy] = useState(false);
  const wordmark = useWordmark();
  const fontCss = useEmbeddedFont();
  const assets = useMemo(() => ({ wordmark, fontCss }), [wordmark, fontCss]);

  // the 3D texture rebuild rasterises the high-res rings; debounce so typing stays smooth
  const debouncedModel = useDebounced(model, 160);
  const faces = useMemo(() => buildFaces(debouncedModel, assets), [debouncedModel, assets]);

  const selectRing = useCallback((seed: string) => setModel((m) => ({ ...m, seed })), []);
  const onChange = useCallback(
    (key: keyof CardModel, value: string) => setModel((m) => ({ ...m, [key]: value })),
    [],
  );
  const exportSvg = useCallback(() => downloadSVG(model, assets), [model, assets]);
  const exportPdf = useCallback(async () => {
    setBusy(true);
    try {
      await downloadPDF(model, assets);
    } finally {
      setBusy(false);
    }
  }, [model, assets]);

  return (
    <div className={styles.tool}>
      <header className={styles.head}>
        <span className="eyebrow">Tools / Business card</span>
        <h1 className={styles.title}>Make it yours</h1>
        <p className={styles.sub}>
          Browse the rings and pick one to anchor your card&rsquo;s colour, edit your details, then export a
          print-ready card. Drag the card to spin it.
        </p>
      </header>

      <div className={styles.stageRow}>
        <div className={styles.cardCol}>
          <BusinessCard3D frontSvg={faces.front} backSvg={faces.back} />
          <p className={styles.hint}>drag to spin</p>
        </div>
        <div className={styles.gridCol}>
          <RingGrid
            seedFor={seedFor}
            colorFor={accentHexForSeed}
            selectedSeed={model.seed}
            onSelect={selectRing}
          />
          <p className={styles.hint}>pan to browse · tap to choose</p>
        </div>
      </div>

      <EditPanel
        model={model}
        onChange={onChange}
        accentHex={accentHexForSeed(model.seed)}
        accentName={accentNameForSeed(model.seed)}
        onExportSvg={exportSvg}
        onExportPdf={exportPdf}
        busy={busy}
      />
    </div>
  );
}
