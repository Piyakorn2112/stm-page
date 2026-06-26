import fs from "node:fs";
import path from "node:path";
import { toDualToneSvg } from "@/utils/dualToneSvg";
import styles from "./styles.module.css";

// Module-level cache: each logo file is read + recoloured once per server process (and,
// for a statically-generated page, once total — at build time). Pure function of a
// static /public asset, so caching it has no correctness implications.
const cache = new Map<string, string>();

function loadDualTone(publicPath: string): string {
  const cached = cache.get(publicPath);
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(process.cwd(), "public", publicPath), "utf8");
  // - aria-hidden/focusable: the wrapper span carries role="img"/aria-label, so hide the
  //   raw inlined svg itself (not announced twice, not a name-less Tab stop).
  // - preserveAspectRatio="xMinYMid meet": force the artwork flush-LEFT inside its box
  //   (default is xMidYMid = centred). With the caller sizing the box to each logo's own
  //   aspect ratio this is normally exact, but it guarantees left alignment even with
  //   sub-pixel rounding — so every logo reads left-aligned, none drift to centre.
  //   (Injected first, so it wins even over any pre-existing preserveAspectRatio.)
  const markup = toDualToneSvg(raw).replace(
    "<svg",
    '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMinYMid meet"',
  );
  cache.set(publicPath, markup);
  return markup;
}

/**
 * DualToneLogo — inlines a brand SVG (server-side) with its greyscale wordmark/ink
 * recoloured to `currentColor` (see utils/dualToneSvg) so it reads correctly in light
 * AND dark mode, while its brand-coloured mark stays fixed. Must be inlined (not an
 * `<img>`) for `currentColor` to resolve against the page's own `--fg` — an externally
 * referenced SVG has no access to the host document's cascade.
 */
export default function DualToneLogo({
  src,
  label,
  className,
}: {
  /** Path under /public, e.g. "/logos/logo-members.svg". */
  src: string;
  /** Accessible name (the inlined SVG itself is hidden from a11y, decorative). */
  label: string;
  className?: string;
}) {
  const markup = loadDualTone(src);
  return (
    <span
      className={`${styles.logo}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
