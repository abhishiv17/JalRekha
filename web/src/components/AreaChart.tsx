import type { Season } from "@/lib/data";

const SERIES = [
  { key: "water_ac", label: "Open water", color: "var(--water)" },
  { key: "floating_veg_ac", label: "Weeds on water", color: "var(--veg)" },
  { key: "bare_built_ac", label: "Bare soil or buildings", color: "var(--bare)" },
  { key: "land_veg_ac", label: "Lake bed now grass", color: "var(--land)" },
] as const;

/** Acres per class across dry seasons; gaps where a season lacks clear images. */
export default function AreaChart({ seasons, selected }: { seasons: Season[]; selected: string }) {
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 28;
  const values = seasons.flatMap((s) => SERIES.map((x) => s[x.key] ?? 0));
  const max = Math.max(1, ...values) * 1.1;
  const x = (i: number) => L + (seasons.length === 1 ? 0 : (i * (W - L - R)) / (seasons.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, max / 2, max].map((v) => Math.round(v * 10) / 10);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lake area by type, each year" width="100%">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {seasons.map((s, i) => (
          <g key={s.season}>
            {s.season === selected && (
              <rect x={x(i) - 10} y={T} width={20} height={H - T - B} fill="var(--line)" opacity={0.6} />
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {s.season.slice(0, 4)}
            </text>
          </g>
        ))}
        {SERIES.map((ser) => {
          const pts = seasons.map((s, i) => (s[ser.key] == null ? null : `${x(i)},${y(s[ser.key] as number)}`));
          const segments: string[][] = [[]];
          pts.forEach((pt) => (pt ? segments.at(-1)!.push(pt) : segments.push([])));
          return (
            <g key={ser.key}>
              {segments.filter((sg) => sg.length > 1).map((sg, j) => (
                <polyline key={j} points={sg.join(" ")} fill="none" stroke={ser.color} strokeWidth={2} />
              ))}
              {seasons.map((s, i) =>
                s[ser.key] == null ? null : (
                  <circle key={s.season} cx={x(i)} cy={y(s[ser.key] as number)} r={3} fill={ser.color} />
                ),
              )}
            </g>
          );
        })}
        <text x={L} y={T - 2} fontSize="11" fill="var(--muted)">acres</text>
      </svg>
      <figcaption className="legend">
        {SERIES.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}
