/**
 * dualToneSvg — recolours the GREYSCALE shapes in a (server-read, trusted, local) brand
 * SVG to `currentColor`, leaving every chromatic (brand-colour) shape's fill untouched.
 * Inlining the result with `currentColor` driving off the page's own `--fg` means a logo
 * with a black wordmark + a coloured icon mark flips its ink to white in dark mode while
 * its brand-coloured mark stays exactly as designed — no canvas/pixel work, no runtime
 * cost: this runs once per asset (cached) wherever it's called from a server component,
 * so for a statically-generated page it resolves entirely at build time.
 *
 * Assumes (true of this project's logo exports, verified against their source): no
 * shape relies on an ancestor `<g fill="...">` for its colour — each shape's own
 * attribute/style (or the SVG-initial default of black) is the whole story.
 */
const SHAPE_TAG = /<(path|rect|circle|ellipse|polygon|polyline|text)\b([^>]*?)(\/?)>/g;
const STYLE_ATTR = /style\s*=\s*"([^"]*)"/;
const FILL_IN_STYLE = /(?:^|;)\s*fill\s*:\s*([^;"]+)/;
const FILL_ATTR = /\bfill\s*=\s*"([^"]*)"/;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function isGrayscale(rawColor: string): boolean {
  const v = rawColor.trim().toLowerCase();
  if (v === "none" || v === "transparent" || v.startsWith("url(")) return false;
  if (v === "currentcolor") return true;
  if (v === "black" || v === "white" || v.startsWith("gray") || v.startsWith("grey")) return true;
  const m = HEX.exec(v);
  if (!m) return false; // rgb()/hsl()/named colours we don't recognise -> leave untouched
  const hex = m[1];
  const [r, g, b] =
    hex.length === 3
      ? hex.split("").map((c) => parseInt(c + c, 16))
      : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((c) => parseInt(c, 16));
  return Math.max(r, g, b) - Math.min(r, g, b) <= 6; // near-equal channels = achromatic
}

function resolvedFill(attrs: string): { value: string; styleBody: string | null } {
  const styleMatch = STYLE_ATTR.exec(attrs);
  if (styleMatch) {
    const fillMatch = FILL_IN_STYLE.exec(styleMatch[1]);
    if (fillMatch) return { value: fillMatch[1].trim(), styleBody: styleMatch[1] };
  }
  const attrMatch = FILL_ATTR.exec(attrs);
  if (attrMatch) return { value: attrMatch[1].trim(), styleBody: null };
  return { value: "black", styleBody: null }; // SVG initial value when nothing sets fill
}

export function toDualToneSvg(svgMarkup: string): string {
  return svgMarkup.replace(SHAPE_TAG, (full, tag, attrs, selfClose) => {
    const { value, styleBody } = resolvedFill(attrs);
    if (!isGrayscale(value)) return full; // chromatic — leave the tag byte-for-byte as-is

    if (styleBody !== null) {
      const nextStyle = styleBody.replace(FILL_IN_STYLE, (m) => (m.startsWith(";") ? ";" : "") + "fill:currentColor");
      return `<${tag}${attrs.replace(STYLE_ATTR, `style="${nextStyle}"`)}${selfClose}>`;
    }
    if (FILL_ATTR.test(attrs)) {
      return `<${tag}${attrs.replace(FILL_ATTR, 'fill="currentColor"')}${selfClose}>`;
    }
    return `<${tag}${attrs} fill="currentColor"${selfClose}>`; // no fill anywhere -> default black
  });
}
