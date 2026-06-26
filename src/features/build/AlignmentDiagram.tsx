/**
 * AlignmentDiagram — a quiet structural figure for "Aligned, not isolated": three
 * independent TEAM pillars (each a small multi-disciplinary cluster, in the three
 * brand colours) held together by shared horizontal ALIGNMENT beams. It conveys the
 * point — independent teams, coherent whole — rather than decorating. Pure SVG, theme
 * -aware via CSS vars; no animation (matches the calm, museum-like page).
 */

const PILLARS = [110, 210, 310]; // x of each team
const BEAMS = [
  { y: 104, label: "Design" },
  { y: 154, label: "Engineering" },
  { y: 204, label: "System" },
];
const TOP = 64; // team cluster height
const BOTTOM = 244;
const DISC = ["var(--orange)", "var(--blue)", "var(--indigo)"]; // the three disciplines

export default function AlignmentDiagram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 290"
      role="img"
      aria-label="Three independent team pillars connected by shared horizontal alignment layers"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* shared alignment beams (the layers every team aligns to) */}
      {BEAMS.map((b) => (
        <g key={b.label}>
          <line x1={58} y1={b.y} x2={372} y2={b.y} stroke="var(--border-strong)" strokeWidth={1.5} strokeLinecap="round" />
          <text
            x={58}
            y={b.y - 9}
            textAnchor="start"
            fontSize={10.5}
            letterSpacing={0.6}
            fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
            fill="var(--faint)"
          >
            {b.label}
          </text>
        </g>
      ))}

      {/* team pillars + the multi-disciplinary cluster at each top */}
      {PILLARS.map((x, i) => (
        <g key={x}>
          <line x1={x} y1={TOP + 14} x2={x} y2={BOTTOM} stroke="var(--border-strong)" strokeWidth={2} strokeLinecap="round" />
          {/* nodes where the pillar meets each shared beam */}
          {BEAMS.map((b) => (
            <circle key={b.y} cx={x} cy={b.y} r={3.4} fill="var(--fg)" />
          ))}
          {/* the small multi-disciplinary team (three disciplines, three colours) */}
          <circle cx={x} cy={TOP - 8} r={5.5} fill={DISC[i % 3]} />
          <circle cx={x - 11} cy={TOP + 4} r={5.5} fill={DISC[(i + 1) % 3]} />
          <circle cx={x + 11} cy={TOP + 4} r={5.5} fill={DISC[(i + 2) % 3]} />
        </g>
      ))}
    </svg>
  );
}
