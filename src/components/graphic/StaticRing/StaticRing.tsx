"use client";

/**
 * StaticRing — one rendered, NON-animated ring. It calls the engine's static
 * export (exportThumbnailSVG) once and paints the result as a background image:
 * a twisted, settled "expressive" ring (not the resting circle), deterministic
 * per `seed`. No rAF, no loop — the live ring stays unique to the hero.
 *
 * Theme-correct: on dark surfaces the near-black rest wire is swapped for the
 * theme's light wire (same substitution the field uses), so the ring reads in
 * both modes. Fills its parent; the caller sizes it.
 */

import { useMemo, type CSSProperties } from "react";
import { exportThumbnailSVG, DARK_BASE } from "@stm-ring";
import { useStructureTheme } from "@/utils/structureTheme";

export default function StaticRing({
  seed,
  grayscale = false,
  segments = 240,
  pieces = 60,
  className,
  style,
}: {
  seed: string | number;
  grayscale?: boolean;
  segments?: number;
  pieces?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = useStructureTheme();
  const bg = useMemo(() => {
    let svg = exportThumbnailSVG(seed, 200, grayscale, segments, pieces);
    if (theme.dark) {
      svg = svg.split(DARK_BASE[0]).join(theme.ringBase[0]).split(DARK_BASE[1]).join(theme.ringBase[1]);
    }
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }, [seed, grayscale, segments, pieces, theme.dark, theme.ringBase]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: "100%",
        height: "100%",
        backgroundImage: bg,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
        ...style,
      }}
    />
  );
}
