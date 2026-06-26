/**
 * bloomCode — a seeded, decorative "scanner/sun" motif for the card back. Concentric
 * dashed/dotted arcs + radial ticks, deterministic per seed. It carries no real data
 * (per the brief: "randomized, no meaning — a clipped decoration + a basic level of
 * visual verification"). Returns an SVG `<g>` in the face's mm coordinate space; the
 * caller positions its centre near the bottom-right so the card edge clips it.
 */

const hashStr = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const f = (n: number) => n.toFixed(3);
const TAU = Math.PI * 2;

function arc(cx: number, cy: number, r: number, a0: number, a1: number, col: string, w: number, dash: string): string {
  const common = `fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-dasharray="${dash}" stroke-linecap="round"`;
  if (a1 - a0 >= TAU - 1e-3) {
    return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${common}/>`;
  }
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const large = (a1 - a0) % TAU > Math.PI ? 1 : 0;
  return `<path d="M${f(x0)} ${f(y0)} A ${f(r)} ${f(r)} 0 ${large} 1 ${f(x1)} ${f(y1)}" ${common}/>`;
}

export function buildBloomCode(
  seed: string | number,
  o: { cx: number; cy: number; rMax: number; color: string; pop: string },
): string {
  const rnd = mulberry32(hashStr(`${seed}::bloom`));
  const { cx, cy, rMax, color, pop } = o;
  let out = "";

  // concentric dashed/dotted rings
  const rings = 8 + ((rnd() * 4) | 0); // 8..11
  for (let i = 0; i < rings; i++) {
    const r = rMax * (0.14 + 0.86 * (i / (rings - 1)));
    const w = 0.16 + rnd() * 0.18;
    const full = rnd() < 0.32;
    const a0 = full ? 0 : rnd() * TAU;
    const a1 = full ? TAU : a0 + (0.45 + rnd() * 1.35) * Math.PI;
    const dot = rnd() < 0.5;
    const dash = dot
      ? `${f(0.04 + rnd() * 0.08)} ${f(0.5 + rnd() * 0.7)}`
      : `${f(0.7 + rnd() * 1.7)} ${f(0.45 + rnd() * 0.6)}`;
    const col = i > 1 && rnd() < 0.15 ? pop : color;
    out += arc(cx, cy, r, a0, a1, col, w, dash);
  }

  // radial ticks scattered through the band
  const ticks = 22 + ((rnd() * 18) | 0);
  for (let i = 0; i < ticks; i++) {
    const a = rnd() * TAU;
    const r0 = rMax * (0.18 + rnd() * 0.74);
    const len = rMax * (0.025 + rnd() * 0.09);
    const x0 = cx + Math.cos(a) * r0;
    const y0 = cy + Math.sin(a) * r0;
    const x1 = cx + Math.cos(a) * (r0 + len);
    const y1 = cy + Math.sin(a) * (r0 + len);
    const col = rnd() < 0.12 ? pop : color;
    out += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${col}" stroke-width="${f(
      0.14 + rnd() * 0.12,
    )}" stroke-linecap="round"/>`;
  }

  return `<g opacity="0.9">${out}</g>`;
}
