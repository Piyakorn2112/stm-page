"use client";

/**
 * CardStage — client-only mount point for the 3D LanyardCard. The three.js stack
 * is heavy and touches the DOM/WebGL, so we load it with ssr:false and show a
 * quiet placeholder until it's ready. Name + id flow through to the card face.
 */

import dynamic from "next/dynamic";

const LanyardCard = dynamic(() => import("./LanyardCard"), {
  ssr: false,
  loading: () => <div aria-hidden="true" />,
});

export default function CardStage({
  name,
  id,
  focused,
  onRequestFocus,
  onRequestBlur,
}: {
  name: string;
  id: string;
  focused: boolean;
  onRequestFocus: () => void;
  onRequestBlur: () => void;
}) {
  return (
    <LanyardCard
      name={name}
      id={id}
      focused={focused}
      onRequestFocus={onRequestFocus}
      onRequestBlur={onRequestBlur}
    />
  );
}
