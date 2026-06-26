"use client";

/**
 * BusinessCard3D — client-only mount for the 3D card (the three.js stack is heavy and
 * touches WebGL, so it loads with ssr:false). Pass the two face SVG strings; the scene
 * rasterises them to textures and lets you spin the card with inertia.
 */

import dynamic from "next/dynamic";

const CardScene = dynamic(() => import("./CardScene"), {
  ssr: false,
  loading: () => <div aria-hidden="true" />,
});

export default function BusinessCard3D({ frontSvg, backSvg }: { frontSvg: string; backSvg: string }) {
  return <CardScene frontSvg={frontSvg} backSvg={backSvg} />;
}
