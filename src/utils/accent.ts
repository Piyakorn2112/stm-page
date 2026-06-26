import type { CSSProperties } from "react";

/** Sets a section's brand `--accent` CSS variable (eyebrow rule, accent word, ghost ring). */
export const accent = (v: string) => ({ ["--accent"]: v } as CSSProperties);
