"use client";

import { useEffect, useState } from "react";

/**
 * useEmbeddedFont — Inter, fetched once and inlined as a base64 woff2 `@font-face`.
 * An SVG rendered through `<img>` (the 3D texture) or opened by a print shop is
 * ISOLATED from the page's web-fonts, so the card text would otherwise fall back to a
 * system sans. We subset to printable ASCII (keeps it ~15–25KB), rename the family to
 * `InterCard`, cache module-wide, and degrade gracefully (the FONT stack falls back to
 * Inter/Helvetica/Arial) if the fetch ever fails.
 */
let cache: string | null = null;
let inflight: Promise<string | null> | null = null;

const ASCII = (() => {
  let s = "";
  for (let c = 0x20; c <= 0x7e; c++) s += String.fromCharCode(c);
  return s;
})();

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function load(): Promise<string | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@400..700&text=${encodeURIComponent(
      ASCII,
    )}&display=swap`;
    let css = await (await fetch(cssUrl)).text();
    const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
    if (!urls.length) return null;
    for (const u of urls) {
      const buf = await (await fetch(u)).arrayBuffer();
      css = css.split(u).join(`data:font/woff2;base64,${toBase64(buf)}`);
    }
    // rename so it can't clash with the page's own Inter @font-face
    return css.replace(/font-family:\s*(['"])Inter\1/g, `font-family:'InterCard'`);
  } catch {
    return null;
  }
}

export function useEmbeddedFont(): string | null {
  const [css, setCss] = useState<string | null>(cache);
  useEffect(() => {
    if (cache) return;
    if (!inflight) inflight = load();
    let alive = true;
    inflight.then((c) => {
      cache = c;
      if (alive) setCss(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return css;
}
