import type { FeatureCollection, FlagProps } from "@/lib/data";

type Bounds = [number, number, number, number];
type RefFC = FeatureCollection<{ kind: "reference" | "buffer"; width_m?: number }>;

const rings = (g: GeoJSON.Geometry): number[][][] =>
  g.type === "Polygon" ? [g.coordinates[0]] : g.type === "MultiPolygon" ? g.coordinates.map((p) => p[0]) : [];

function pathOf(g: GeoJSON.Geometry, [w, s, e, n]: Bounds) {
  return rings(g)
    .map((r) => "M" + r.map(([x, y]) => `${(((x - w) / (e - w)) * 1000).toFixed(1)} ${(((n - y) / (n - s)) * 1000).toFixed(1)}`).join("L") + "Z")
    .join("");
}

type OutlineProps = { bounds: Bounds; reference?: RefFC; flags?: FeatureCollection<FlagProps>; focus?: string | null };

/** Lake outline (white) and change flags (orange), sized to cover the image under it. */
export function Outlines({ bounds, reference, flags, focus }: OutlineProps) {
  const lake = reference?.features.find((f) => f.properties.kind === "reference");
  return (
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        {lake && (
          <path d={pathOf(lake.geometry, bounds)} fill="none" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        )}
        {flags?.features.map((f) => (
          <path key={f.properties.flag_id} d={pathOf(f.geometry, bounds)} fill="#f5a524" fillOpacity={focus === f.properties.flag_id ? 0.45 : 0.18}
            stroke="#f5a524" strokeWidth={focus === f.properties.flag_id ? 3 : 2} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
  );
}

/** A satellite image with the lake outline and change flags drawn on it. */
export default function OutlinedImage({ src, alt, ...outline }: OutlineProps & { src: string; alt: string }) {
  return (
    <div className="outlined">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <Outlines {...outline} />
    </div>
  );
}
