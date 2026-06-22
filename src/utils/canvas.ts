/**
 * Size a canvas's backing store to its CSS box × devicePixelRatio (capped at 2 — beyond
 * that the extra pixels aren't worth the fill cost) and set its CSS width/height. Returns
 * the dpr so the caller can scale its context (`ctx.setTransform(dpr,0,0,dpr,0,0)`) or its
 * own world transform. Shared by every canvas field.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  return dpr;
}
