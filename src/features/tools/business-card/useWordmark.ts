"use client";

import { useEffect, useState } from "react";
import type { WordmarkAsset } from "./cardFaces";

// The "srang tech mai" lockup, fetched once and shared. SVG-as-image can't see the
// page's web fonts, so the wordmark must be embedded as real vector paths (it also
// keeps the print export resolution-independent).
let cache: WordmarkAsset | null = null;

export function useWordmark(): WordmarkAsset | null {
  const [wm, setWm] = useState<WordmarkAsset | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch(encodeURI("/STM logo long text.svg"))
      .then((r) => r.text())
      .then((text) => {
        const vb = text.match(/viewBox="([^"]+)"/i)?.[1] ?? "0 0 806 127";
        const inner = text.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
        cache = { viewBox: vb, inner };
        if (alive) setWm(cache);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return wm;
}
