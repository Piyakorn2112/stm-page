/**
 * cardModel — the data model for the business-card tool, plus the physical
 * constants every consumer shares (the SVG face builder, the 3D card, the export).
 *
 * The card is a real 90×54mm business card. One ring SEED drives both faces (the
 * front shows it in full colour, the back the same seed in grey); the ACCENT is
 * derived from that seed — a ring's primary charge colour is, by construction, one
 * of the three brand hues (PALETTE), so we recover which one by matching hue.
 */
import { PALETTE, hexToOklab, makeHover } from "@stm-ring";

/* ── physical dimensions (mm) — shared by faces, 3D mesh and print export ──────── */
export const CARD_MM = { w: 90, h: 54 } as const; // ISO-ish standard business card
export const BLEED_MM = 3; // print bleed on every edge
export const CORNER_MM = 1.4; // a *small* rounded corner (it's a paper card, not a badge)
export const CARD_ASPECT = CARD_MM.w / CARD_MM.h; // 1.667

/* ── the editable model ───────────────────────────────────────────────────────── */
export type CardModel = {
  seed: string; // ring seed → shape + accent
  name: string;
  title: string;
  email: string;
  tel: string;
  url: string; // the small site label on the back, top-right
};

/** Ships as a blank template — empty fields render the generic placeholders on the
 *  card (and the inputs show their prompts); only the default ring seed is set. */
export const DEFAULT_MODEL: CardModel = {
  seed: "srang-tech-mai",
  name: "",
  title: "",
  email: "",
  tel: "",
  url: "",
};

/* ── accent derivation ────────────────────────────────────────────────────────── */
// Each PALETTE hue, precomputed once. A seed's charge.primary is built as
// `at(hueOf(PALETTE[i]), L, C)` inside makeHover, so its OKLab hue equals the source
// brand hue exactly — nearest-hue match recovers the index with no core coupling.
const PALETTE_HUE = PALETTE.map((hex) => {
  const { a, b } = hexToOklab(hex);
  return Math.atan2(b, a);
});

const hueDist = (a: number, b: number): number => {
  const TAU = Math.PI * 2;
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
};

/** Which brand colour (0=indigo, 1=blue, 2=orange) a seed's ring anchors to. */
export function accentIndexForSeed(seed: string | number): number {
  const { a, b } = makeHover(seed).charge.primary;
  const hue = Math.atan2(b, a);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE_HUE.length; i++) {
    const d = hueDist(hue, PALETTE_HUE[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** The seed's anchoring brand hex (one of the three PALETTE colours). */
export const accentHexForSeed = (seed: string | number): string =>
  PALETTE[accentIndexForSeed(seed)];

export const ACCENT_NAMES = ["Indigo", "Blue", "Orange"] as const;

/** Human name of the seed's anchoring brand colour. */
export const accentNameForSeed = (seed: string | number): string =>
  ACCENT_NAMES[accentIndexForSeed(seed)];
