// Shapes for the lake story: project WGS84 outlines onto the lake's satellite photo.
// The photo covers the lake's bounds exactly, so a linear map is enough at this scale.

type Bounds = [number, number, number, number]; // west, south, east, north
type Geometry = { type: string; coordinates: unknown };

export function projector(bounds: Bounds, width = 1000) {
  const [w, s, e, n] = bounds;
  const lat = ((s + n) / 2) * (Math.PI / 180);
  const height = Math.round((width * (n - s)) / ((e - w) * Math.cos(lat)));
  const xy = ([lon, la]: number[]): [number, number] => [((lon - w) / (e - w)) * width, ((n - la) / (n - s)) * height];
  return { w: width, h: height, xy };
}

/** SVG path data for a Polygon or MultiPolygon (all rings; use fill-rule evenodd for holes). */
export function toPath(geom: Geometry | null | undefined, xy: (p: number[]) => [number, number]): string {
  if (!geom) return "";
  const polys = (geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : []) as number[][][][];
  return polys
    .flatMap((rings) => rings.map((ring) => "M" + ring.map((p) => xy(p).map((v) => v.toFixed(1)).join(",")).join("L") + "Z"))
    .join("");
}

/** Centre of a path's points, as percentages of the stage, to place a label near it. */
export function centreOf(geom: Geometry | null | undefined, xy: (p: number[]) => [number, number], w: number, h: number) {
  const polys = (geom?.type === "Polygon" ? [geom.coordinates] : geom?.type === "MultiPolygon" ? geom.coordinates : []) as number[][][][];
  const pts = polys.flatMap((r) => r[0] ?? []).map(xy);
  if (!pts.length) return null;
  const x = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return { x: (100 * x) / w, y: (100 * y) / h };
}

/** Like toPath, but only the polygons whose centre lies within a box around the lake
 *  (in projected units), so stray wet patches elsewhere in the photo aren't shown. */
export function toPathNear(geom: Geometry | null | undefined, xy: (p: number[]) => [number, number],
  box: { x0: number; y0: number; x1: number; y1: number }): string {
  if (!geom) return "";
  const polys = (geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : []) as number[][][][];
  const keep = polys.filter((rings) => {
    const pts = (rings[0] ?? []).map(xy);
    if (!pts.length) return false;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return cx >= box.x0 && cx <= box.x1 && cy >= box.y0 && cy <= box.y1;
  });
  return toPath({ type: "MultiPolygon", coordinates: keep }, xy);
}

/** Bounding box of a geometry in projected units, grown by a margin. */
export function boxOf(geom: Geometry | null | undefined, xy: (p: number[]) => [number, number], margin: number) {
  const polys = (geom?.type === "Polygon" ? [geom.coordinates] : geom?.type === "MultiPolygon" ? geom.coordinates : []) as number[][][][];
  const pts = polys.flatMap((r) => r[0] ?? []).map(xy);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs) - margin, y0: Math.min(...ys) - margin, x1: Math.max(...xs) + margin, y1: Math.max(...ys) + margin };
}
