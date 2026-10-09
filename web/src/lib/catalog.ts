// Every lake the app lists.
// - Analysed lakes: numbers from the pipeline's index.json, plus place and thumbnail here.
// - The India catalog: named lakes, tanks and reservoirs from OpenStreetMap
//   (pipeline/scripts/osm_india_lakes.py), shown as "Queued" with their outline.
// - A few catalog lakes also carry a real 2026 Sentinel-2 thumbnail (FEATURED).
// Queued lakes never show change numbers: they have not been analysed.

import { type LakeSummary, lakeUrl, loadFlags } from "./data";

export type Place = { city: string; state: string };

type AnalysedMeta = Place & { thumb: string; lat: number; lon: number; osmId?: string; note?: string };

export const ANALYSED_META: Record<string, AnalysedMeta> = {
  "subedeharana-kere": { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/subedeharana-kere.png", lat: 12.8598, lon: 77.6166 },
  "pattandur-agrahara": { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/pattandur-agrahara.png", lat: 12.98, lon: 77.7384 },
  "ambalipura-kelagina": { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/ambalipura-kelagina.png", lat: 12.9173, lon: 77.6656 },
  sadaramangala: { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/sadaramangala.png", lat: 13.003, lon: 77.7295 },
  "yele-mallappa-shetty": { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/yele-mallappa-shetty.png", lat: 13.0173, lon: 77.7332 },
  jakkur: {
    city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/jakkur.png", lat: 13.0866, lon: 77.6127,
    note: "Most flagged area is construction in the 30 m buffer on the east side and a new structure at the north-west inlet; verify whether these are approved works.",
  },
  bellandur: {
    city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/bellandur.png", lat: 12.93482, lon: 77.66382, osmId: "osm-r19751547",
    note: "The imagery shows this lake drained and under earthworks from 2021 (bare, excavated lake bed; works along the southern edge). Most flags here are works in progress, not encroachment. Verify each one.",
  },
  varthur: { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/varthur.png", lat: 12.94722, lon: 77.73629, osmId: "osm-r19306126" },
  kaikondrahalli: { city: "Bengaluru", state: "Karnataka", thumb: "/thumbs/kaikondrahalli.png", lat: 12.91289, lon: 77.67273, osmId: "osm-r6820030" },
  "durgam-cheruvu": { city: "Hyderabad", state: "Telangana", thumb: "/thumbs/durgam-cheruvu.png", lat: 17.43021, lon: 78.38991, osmId: "osm-w28131043" },
  ameenpur: { city: "Hyderabad", state: "Telangana", thumb: "/thumbs/ameenpur.png", lat: 17.52312, lon: 78.33316, osmId: "osm-w115772000" },
  chembarambakkam: { city: "Chennai", state: "Tamil Nadu", thumb: "/thumbs/chembarambakkam.jpg", lat: 13.00825, lon: 80.05548, osmId: "osm-w25453624" },
  mallathahalli: {
    city: "Bengaluru", state: "Karnataka", thumb: lakeUrl("mallathahalli", "truecolor/2026-dry.png"), lat: 12.96509, lon: 77.49455, osmId: "osm-w37898906",
    note: "Most flagged change here is the lake's own development works: a perimeter path and road, a plaza, a filled corner pond and a built-up island. In March 2023 the Karnataka High Court barred construction in this lake; compare the dates here with that order, and verify each flag before acting.",
  },
};

/** Catalog lakes with a real satellite thumbnail, matched to OSM lakes by location. */
export const FEATURED: (Place & { name: string; thumb: string; lat: number; lon: number })[] = [
  { name: "Hussain Sagar", city: "Hyderabad", state: "Telangana", thumb: "/thumbs/hussain-sagar.jpg", lat: 17.4239, lon: 78.4738 },
  { name: "Powai Lake", city: "Mumbai", state: "Maharashtra", thumb: "/thumbs/powai.jpg", lat: 19.127, lon: 72.905 },
  { name: "Pallikaranai Marsh", city: "Chennai", state: "Tamil Nadu", thumb: "/thumbs/pallikaranai.jpg", lat: 12.938, lon: 80.215 },
  { name: "Bhalswa Lake", city: "Delhi", state: "Delhi", thumb: "/thumbs/bhalswa.jpg", lat: 28.742, lon: 77.165 },
  { name: "Rabindra Sarobar", city: "Kolkata", state: "West Bengal", thumb: "/thumbs/rabindra-sarobar.jpg", lat: 22.512, lon: 88.363 },
  { name: "Kankaria Lake", city: "Ahmedabad", state: "Gujarat", thumb: "/thumbs/kankaria.jpg", lat: 23.0063, lon: 72.601 },
  { name: "Upper Lake (Bhojtal)", city: "Bhopal", state: "Madhya Pradesh", thumb: "/thumbs/upper-lake-bhopal.jpg", lat: 23.25, lon: 77.34 },
  { name: "Sukhna Lake", city: "Chandigarh", state: "Chandigarh", thumb: "/thumbs/sukhna.jpg", lat: 30.742, lon: 76.818 },
  { name: "Dal Lake", city: "Srinagar", state: "Jammu and Kashmir", thumb: "/thumbs/dal.jpg", lat: 34.11, lon: 74.87 },
  { name: "Vellayani Lake", city: "Thiruvananthapuram", state: "Kerala", thumb: "/thumbs/vellayani.jpg", lat: 8.412, lon: 76.987 },
];

/** One row of /catalog/india.json. */
export type OsmLake = { id: string; name: string; state: string; near: string | null; lat: number; lon: number; ha: number };

/** One card's worth of data, for analysed and queued lakes alike. */
export type Card = Place & {
  id: string;
  name: string;
  analysed: boolean;
  thumb?: string; // satellite image, when we have one
  shapeState?: string; // state whose shapes file holds this lake's outline
  areaAc?: number;
  flaggedAc?: number;
  firstSeen?: string | null;
  note?: string;
  lat?: number;
  lon?: number;
  kinds?: string[]; // change categories among the lake's flags (analysed lakes only)
};

/** Where a card links: analysed lakes have full pages, the rest a catalog page. */
export const cardHref = (c: Card) => (c.analysed ? `/lake/${c.id}/` : `/lakes/view/?id=${encodeURIComponent(c.id)}`);

export const placeLabel = (p: Place) =>
  !p.city ? p.state : p.city === p.state ? p.city : `${p.city}, ${p.state}`;

export const stateKey = (state: string) => state.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const HA_PER_AC = 0.404686;
const near = (a: { lat: number; lon: number }, b: { lat: number; lon: number }, km: number) =>
  Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180)) < km;

export async function loadCatalog(): Promise<OsmLake[]> {
  try {
    const res = await fetch("/catalog/india.json");
    return res.ok ? ((await res.json()) as OsmLake[]) : [];
  } catch {
    return [];
  }
}

export function cards(analysed: LakeSummary[], osm: OsmLake[] = []): Card[] {
  const done: Card[] = analysed.map((l) => {
    const meta = ANALYSED_META[l.id];
    return {
      id: l.id,
      name: l.name,
      city: meta?.city ?? "",
      state: meta?.state ?? "",
      thumb: meta?.thumb ?? lakeUrl(l.id, "truecolor/2026-dry.png"),
      analysed: true,
      areaAc: l.area_ac,
      flaggedAc: l.flagged_ac,
      firstSeen: l.latest_first_seen,
      note: meta?.note,
      lat: meta?.lat ?? l.centroid[1],
      lon: meta?.lon ?? l.centroid[0],
    };
  });
  const analysedSpots = Object.values(ANALYSED_META);
  const analysedOsm = new Set(analysedSpots.map((a) => a.osmId).filter(Boolean));
  const featuredUsed = new Set<string>();

  const queued: Card[] = [];
  const seen = new Set<string>();
  for (const o of osm) {
    if (seen.has(o.id)) continue; // a lake on a state border is listed by both states
    seen.add(o.id);
    if (analysedOsm.has(o.id) || analysedSpots.some((a) => near(a, o, 0.6))) continue; // already analysed
    const f = FEATURED.find((x) => !featuredUsed.has(x.name) && near(x, o, 2));
    if (f) featuredUsed.add(f.name);
    queued.push({
      id: o.id,
      name: f?.name ?? o.name,
      city: f?.city ?? o.near ?? "",
      state: o.state,
      analysed: false,
      thumb: f?.thumb,
      shapeState: stateKey(o.state),
      areaAc: o.ha / HA_PER_AC,
      lat: o.lat,
      lon: o.lon,
    });
  }
  // Without the catalog (or if OSM lacks one), featured lakes still show.
  for (const f of FEATURED) {
    if (!featuredUsed.has(f.name)) {
      queued.push({ id: `featured-${stateKey(f.name)}`, name: f.name, city: f.city, state: f.state, analysed: false, thumb: f.thumb, lat: f.lat, lon: f.lon });
    }
  }
  return [...done, ...queued];
}

export type Status = { label: string; tone: "changed" | "steady" | "queued" | "nodata"; key: StatusKey };
export type StatusKey = "changed" | "nochange" | "nodata" | "queued";

/** Never treats "not analysed" as "no change". */
export function statusOf(c: Card): Status {
  if (!c.analysed) return { label: "Not checked yet", tone: "queued", key: "queued" };
  if (c.flaggedAc == null) return { label: "Too cloudy to judge", tone: "nodata", key: "nodata" };
  if (!c.flaggedAc) return { label: "Holding steady", tone: "steady", key: "nochange" };
  return { label: `${c.flaggedAc.toFixed(1)} ac turned to land`, tone: "changed", key: "changed" };
}

export const KIND_LABELS: Record<string, string> = {
  fill_or_construction: "Fill or construction",
  vegetated_land: "Lake bed grassed over",
};

/** Change categories per analysed lake, from its flags. */
export async function loadKinds(ids: string[]): Promise<Record<string, string[]>> {
  const pairs = await Promise.all(
    ids.map(async (id) => {
      try {
        const fc = await loadFlags(id);
        return [id, Array.from(new Set(fc.features.map((f) => f.properties.kind ?? "fill_or_construction")))] as const;
      } catch {
        return [id, []] as const;
      }
    }),
  );
  return Object.fromEntries(pairs);
}
