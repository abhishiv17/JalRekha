// Types and loaders for pipeline results; shapes follow contracts/README.md.

export const DATA_URL = (process.env.NEXT_PUBLIC_DATA_URL ?? "/data").replace(/\/$/, "");
export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export type LakeSummary = {
  id: string;
  name: string;
  area_ac: number;
  flagged_ac: number;
  flagged_share: number;
  latest_first_seen: string | null;
  centroid: [number, number];
};

export type Index = { generated: string; lakes: LakeSummary[]; sample?: boolean };

export type Season = {
  season: string;
  clear_looks: number;
  status: "ok" | "not_enough_data";
  water_ac: number | null;
  floating_veg_ac: number | null;
  bare_built_ac: number | null;
  land_veg_ac?: number | null;
  scene_ids: string[];
};

export type Stats = {
  id: string;
  name: string;
  reference_area_ac: number;
  thresholds: Record<string, number>;
  seasons: Season[];
  flags_total_ac: number;
  buffer: {
    current_law_m: number;
    bill_2025_m: number;
    change_in_buffer_ac: Record<string, number>;
  };
  as_of: string;
  sample?: boolean;
};

export type FlagProps = {
  flag_id: string;
  zone: "lakebed" | "buffer";
  area_ac: number;
  first_seen: string;
  status: "confirmed" | "new";
  confidence: "high" | "medium" | "low";
  kind?: "fill_or_construction" | "vegetated_land";
  scene_ids: string[];
};

export type FeatureCollection<P = Record<string, unknown>> = {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: P; geometry: GeoJSON.Geometry }[];
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_URL}/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const lakeUrl = (id: string, file: string) => `${DATA_URL}/lakes/${id}/${file}`;

export const loadIndex = () => getJson<Index>("index.json");
export const loadStats = (id: string) => getJson<Stats>(`lakes/${id}/stats.json`);
export const loadFlags = (id: string) => getJson<FeatureCollection<FlagProps>>(`lakes/${id}/flags.geojson`);
export const loadReference = (id: string) =>
  getJson<FeatureCollection<{ kind: "reference" | "buffer"; width_m?: number }>>(`lakes/${id}/reference.geojson`);
export const loadBounds = (id: string) =>
  getJson<{ bounds: [number, number, number, number] }>(`lakes/${id}/bounds.json`);

export const drySeasons = (s: Stats) => s.seasons.filter((x) => x.season.endsWith("-dry"));

export const seasonLabel = (season: string) => {
  const [year, kind] = season.split("-");
  return `${kind === "dry" ? "Dry season" : "Post-monsoon"} ${year}`;
};

export const kindLabel = (kind?: string) =>
  kind === "vegetated_land" ? "Lake bed now grassed land" : "Fill or construction";
