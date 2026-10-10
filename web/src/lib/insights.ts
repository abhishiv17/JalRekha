// What a lake does for the people around it, measured from space and shipped with the site
// (public/insights, made by pipeline/jalrekha/heat.py and floodlink.py), and the ranking built on it.

import { cards } from "./catalog";
import type { LakeSummary } from "./data";

export type Heat = {
  id: string;
  period: string;
  passes: number;
  water_c: number | null;
  near_c: number | null;
  far_c: number | null;
  near_m: [number, number];
  far_m: [number, number];
  cooler_near_c: number | null;
  filled_ac: number;
  filled_c: number | null;
  filled_hotter_c: number | null;
  scale_c: [number, number];
  image: string;
  bounds: [number, number, number, number];
};

export type FloodLink = {
  event: string;
  name: string;
  date: string;
  flooded_ha_near: number;
  near_m: number;
  share_near: number;
  share_city: number;
  times_city: number | null;
  flooded_ha_near_lost: number | null;
  image: string;
  bounds: [number, number, number, number];
};

/** Flags compared with sharper photos, per lake (pipeline/scripts/checked_by_lake.py). */
export type Checked = { checked: number; confirmed_ac: number; not_confirmed_ac: number; unclear_ac: number };

export type Insights = { heat: Record<string, Heat>; floods: Record<string, FloodLink>; checked: Record<string, Checked> };

let cached: Promise<Insights> | null = null;
export function loadInsights(): Promise<Insights> {
  cached ??= Promise.all([
    fetch("/insights/heat.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch("/insights/floods.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch("/insights/checked.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]).then(([heat, floods, checked]) => ({ heat, floods, checked }));
  return cached;
}

export const dateWords = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export type Reason = { key: "lost" | "share" | "recent" | "hotter" | "cooler" | "flood" | "confirmed" | "dropped"; text: string };
export type Priority = {
  id: string;
  name: string;
  city: string;
  state: string;
  thumb?: string;
  note?: string; // the lake's "read this first" caveat, when it has one
  rank: number;
  score: number; // 0-100
  reasons: Reason[];
};

// How much each reason counts. Losing lake is what this site measures best, so it leads;
// heat and floods add weight where we have them. Shown on the page, nothing hidden.
export const WEIGHTS = { lost: 1, share: 1, recent: 0.5, heat: 0.75, flood: 0.75 } as const;

/** Rank 0..1 among the values given (ties share a rank); 0 for missing or zero. */
function percentile(values: (number | null)[]) {
  const real = values.filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  return (v: number | null) => {
    if (v == null || v <= 0 || !real.length) return 0;
    const below = real.filter((x) => x < v).length;
    const same = real.filter((x) => x === v).length;
    return (below + same) / real.length;
  };
}

export function rankLakes(lakes: LakeSummary[], { heat, floods, checked }: Insights): Priority[] {
  // Flags that didn't hold up on sharper photos don't count; confirmed and unchecked ones do.
  const lostAc = (l: LakeSummary) => Math.max(l.flagged_ac - (checked[l.id]?.not_confirmed_ac ?? 0), 0);
  const lostShare = (l: LakeSummary) => (l.flagged_ac > 0 ? (l.flagged_share * lostAc(l)) / l.flagged_ac : 0);
  const byId = new Map(cards(lakes).map((c) => [c.id, c]));
  const year = (s: string | null) => (s ? Number(s.slice(0, 4)) : null);
  const heatAtStake = (id: string) => {
    const h = heat[id];
    if (!h) return null;
    return Math.max(h.filled_hotter_c ?? 0, 0) + Math.max(h.cooler_near_c ?? 0, 0);
  };
  const floodPressure = (id: string) => {
    const f = floods[id];
    return f && f.flooded_ha_near > 0 ? f.share_near / Math.max(f.share_city, 1e-4) : null;
  };

  const pLost = percentile(lakes.map(lostAc));
  const pShare = percentile(lakes.map(lostShare));
  const pRecent = percentile(lakes.map((l) => (lostAc(l) > 0 ? year(l.latest_first_seen) : null)));
  const pHeat = percentile(lakes.map((l) => heatAtStake(l.id)));
  const pFlood = percentile(lakes.map((l) => floodPressure(l.id)));
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

  const rows = lakes.map((l) => {
    const h = heat[l.id];
    const f = floods[l.id];
    const lost = lostAc(l);
    const c = checked[l.id];
    const recentYear = lost > 0 ? year(l.latest_first_seen) : null;
    const score =
      (WEIGHTS.lost * pLost(lost) + WEIGHTS.share * pShare(lostShare(l)) + WEIGHTS.recent * pRecent(recentYear) +
        WEIGHTS.heat * pHeat(heatAtStake(l.id)) + WEIGHTS.flood * pFlood(floodPressure(l.id))) / total;

    const reasons: Reason[] = [];
    if (lost > 0.05) {
      reasons.push({ key: "lost", text: `${lost.toFixed(1)} acres turned into land (${(lostShare(l) * 100).toFixed(1)}% of the lake)` });
      if (c && c.confirmed_ac > 0) reasons.push({ key: "confirmed", text: `${c.confirmed_ac.toFixed(1)} acres confirmed on sharper photos` });
      if (recentYear && recentYear >= 2025) reasons.push({ key: "recent", text: `Still changing: new land seen in ${recentYear}` });
    }
    if (c && c.not_confirmed_ac > 0.05)
      reasons.push({ key: "dropped", text: `${c.not_confirmed_ac.toFixed(1)} acres not counted: they didn't hold up on sharper photos` });
    if (h?.filled_hotter_c != null && h.filled_hotter_c > 0)
      reasons.push({ key: "hotter", text: `Filled lake bed is ${h.filled_hotter_c.toFixed(1)} °C hotter than the water in summer` });
    if (h?.cooler_near_c != null && h.cooler_near_c >= 0.5)
      reasons.push({ key: "cooler", text: `Ground near it is ${h.cooler_near_c.toFixed(1)} °C cooler than ground further away` });
    if (f && f.flooded_ha_near >= 1)
      reasons.push({ key: "flood", text: `${f.flooded_ha_near.toFixed(1)} ha flooded within 1 km on ${dateWords(f.date)}` });

    const card = byId.get(l.id);
    return { id: l.id, name: l.name, city: card?.city ?? "", state: card?.state ?? "", thumb: card?.thumb, note: card?.note, rank: 0, score: Math.round(score * 100), reasons };
  });
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
