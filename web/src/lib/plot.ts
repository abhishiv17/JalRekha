// Plot Check: types and calls for the Plot Check API (infra/plot/api.py).

export const PLOT_API_URL = process.env.NEXT_PUBLIC_PLOT_API_URL?.replace(/\/$/, "");

export type Level = "high" | "watch" | "low" | "unknown";
export type Lang = "en" | "kn" | "te" | "hi";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "kn", label: "ಕನ್ನಡ" },
  { id: "te", label: "తెలుగు" },
  { id: "hi", label: "हिंदी" },
];

export type SeasonAtPin = {
  season: string; // "2021-dry" | "2021-post"
  status: "ok" | "not_enough_data";
  water_at_pin: boolean | null;
  clear_looks_at_pin: number;
  scene_count: number;
};

export type BufferRule = {
  rule: "ktcda_2014" | "ktcda_bill_2025" | "hmda" | "reference_30m";
  width_m: number;
  status: "in_force" | "proposed" | "reference";
  inside: boolean;
};

export type FloodAtPin = {
  id: string;
  name: string;
  date: string;
  flooded_at_pin: boolean;
  pin_in_lake: boolean;
  share_flooded_250m: number | null;
};

export type PlotImage = { path: string; url?: string; season?: string; seasons?: number };

export type Facts = {
  lat: number;
  lon: number;
  address?: string | null;
  history: SeasonAtPin[];
  dry_seasons_checked: number;
  dry_seasons_with_water: string[];
  post_seasons_with_water: string[];
  distance_to_extent_m: number | null;
  in_lake_bed: boolean;
  extent_patch_acres: number | null;
  nearest_lake: { id: string; name: string; state: string; near?: string; area_ha?: number } | null;
  buffer_rules: BufferRule[];
  floods: FloodAtPin[];
  window: { half_size_m: number; bounds: [number, number, number, number] };
  images: { before?: PlotImage; after?: PlotImage; water_frequency?: PlotImage };
};

export type Reason = { code: string; level: Level; [k: string]: unknown };
export type Text = { headline: string; summary: string; checks: string[] };

export type Report = {
  id: string;
  facts: Facts;
  verdict: { level: Level; reasons: Reason[]; text: Record<Lang, Text>; text_source: "bedrock" | "template"; model: string | null };
  made: string;
  seconds: number;
};

export type Check = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  address: string | null;
  lat: number;
  lon: number;
  created?: string;
  error?: string;
  report?: Report;
};

export type Place = { label: string; lat: number; lon: number; type?: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!PLOT_API_URL) throw new Error("Plot Check is not configured in this build");
  const res = await fetch(`${PLOT_API_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `the server answered ${res.status}`);
  return body as T;
}

export const geocode = (q: string) =>
  call<{ results: Place[] }>(`/geocode?q=${encodeURIComponent(q)}`).then((r) => r.results);

export const startCheck = (lat: number, lon: number, address?: string) =>
  call<{ id: string; status: Check["status"]; reused: boolean }>("/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, address }),
  });

export const getCheck = (id: string) => call<Check>(`/check/${encodeURIComponent(id)}`);

export const LEVEL_LABEL: Record<Level, string> = {
  high: "High risk",
  watch: "Watch",
  low: "Low risk",
  unknown: "Not enough data",
};

export const RULE_LABEL: Record<BufferRule["rule"], string> = {
  ktcda_2014: "Karnataka lake buffer (KTCDA Act 2014)",
  ktcda_bill_2025: "Size-based buffer (KTCDA amendment bill 2025)",
  hmda: "Hyderabad lake buffer (HMDA)",
  reference_30m: "30 m from the water's edge",
};

export const RULE_STATUS: Record<BufferRule["status"], string> = {
  in_force: "in force",
  proposed: "proposed, not in force",
  reference: "reference only",
};

export type FloodEvent = { id: string; name: string; date: string; bounds: [number, number, number, number]; flooded_km2: number };

/** Flood events shipped with the site (synced from data/floods). */
export async function loadFloodEvents(): Promise<FloodEvent[]> {
  const res = await fetch("/floods/index.json");
  if (!res.ok) return [];
  return res.json();
}
