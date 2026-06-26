"use client";

/**
 * structureTheme — the /structure hero's colour themes (light + dark) and a hook
 * that follows the OS `prefers-color-scheme`. PRESENTATION ONLY: it never touches
 * the shared `stmRingCore` engine, and the brand PRIMARIES (the charge) are left
 * unchanged in both themes.
 *
 * Dark mode is a calm neutral-grey scheme: a smooth radial backdrop (a little
 * lighter grey at the centre → darker at the edges) and a near-neutral white REST
 * wire (`ringBase`, replacing the near-black `DARK_BASE`, which would be invisible
 * on dark). `ringBase` is fed to StmRing/MorphRing's optional `baseColors` prop and
 * string-substituted into the field's static thumbnails.
 */

import { DARK_BASE } from "@stm-ring";
import { useSyncExternalStore } from "react";

export type StructureTheme = {
  dark: boolean;
  bg: string; // backdrop edge colour + bottom-fade target
  bgCenter: string; // backdrop centre colour (radial) + the ring clearing wash
  ringBase: readonly [string, string]; // rest-wire gradient ramp (light → shaded)
  fadeTo: string; // colour the field fades to at the bottom band
  text: string; // tagline heading
  subtext: string; // tagline body / loader wordmark
};

export const LIGHT_THEME: StructureTheme = {
  dark: false,
  bg: "#ffffff",
  bgCenter: "#ffffff",
  ringBase: [DARK_BASE[0], DARK_BASE[1]] as const,
  fadeTo: "#ffffff",
  text: "#0a0a0b",
  subtext: "#6b6b72",
};

export const DARK_THEME: StructureTheme = {
  dark: true,
  bg: "#0e0f14", // deep neutral grey (radial edge) — strong contrast with the wire
  bgCenter: "#1c1e25", // a little lighter grey (radial centre)
  // Light rest wire with a MODERATE cool/lavender tint — between the original
  // indigo (#C9D2FF→#7E89C8) and neutral white, a little brighter again.
  ringBase: ["#E7EBFC", "#ABB1D4"],
  fadeTo: "#0e0f14",
  text: "#E8E9ED",
  subtext: "#9a9ca5",
};

// Follow the OS colour scheme via useSyncExternalStore: the server snapshot is
// LIGHT (matching the static HTML) and the client snapshot is the real matchMedia
// value, so the FIRST client render is already correct (no flash, no hydration
// mismatch) and it live-updates when the OS setting changes. The page also paints
// a dark backdrop via a CSS media query to cover the pre-hydration window.
const DARK_MQ = "(prefers-color-scheme: dark)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(DARK_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getSnapshot = () => window.matchMedia(DARK_MQ).matches;
const getServerSnapshot = () => false;

export function useStructureTheme(): StructureTheme {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return dark ? DARK_THEME : LIGHT_THEME;
}
