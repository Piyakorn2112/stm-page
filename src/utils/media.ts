/**
 * Shared `matchMedia` helpers. Call these inside an effect (client-only) — they read the
 * live media state, matching the hand-rolled reads they replace exactly.
 */

/** True when the user prefers reduced motion. */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** True when the OS/browser is in dark mode. */
export const prefersDark = (): boolean => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Subscribe to colour-scheme changes; returns an unsubscribe function. */
export function watchColorScheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
