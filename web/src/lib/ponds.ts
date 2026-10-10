// Delhi's ponds: the scan's results (static files) and each pond's case (Plot Check API).

import { PLOT_API_URL } from "./plot";

export type PondStatus = "vanished" | "shrank" | "alive" | "came_back";
export type PondProps = {
  id: string;
  status: PondStatus;
  area_ha: number;
  water_left: number;
  lat: number;
  lon: number;
  now?: "built_or_bare" | "dried_grassed" | "unclear";
  thumbs?: string[];
  district?: string | null;
};
export type Pond = { type: "Feature"; properties: PondProps; geometry: GeoJSON.Geometry };

export type PondSummary = {
  city: string;
  bbox: [number, number, number, number];
  baseline_years: number[];
  recent_years: number[];
  ponds: number;
  alive: number;
  shrank: number;
  vanished: number;
  came_back?: number;
  vanished_ha: number;
  now: { built_or_bare: number; dried_grassed: number; unclear: number };
  left_out?: { drain_or_canal: number; no_clear_recent_look: number; outside_city?: number };
  made: string;
};

export const CITY = "delhi";
export const PONDS_BASE = `/ponds/${CITY}`;

export async function loadPonds(): Promise<{ summary: PondSummary; ponds: Pond[] }> {
  const [a, b] = await Promise.all([fetch(`${PONDS_BASE}/summary.json`), fetch(`${PONDS_BASE}/ponds.geojson`)]);
  if (!a.ok || !b.ok) throw new Error("The pond scan isn't published yet.");
  // "came_back" (water where there was none) is too often the river shifting or a wet field to show as good news;
  // a revival is only claimed for a known pond, checked from space (see the pond page).
  const ponds: Pond[] = (await b.json()).features.filter((f: Pond) => f.properties.status !== "came_back");
  return { summary: await a.json(), ponds };
}

export const acres = (ha: number) => {
  const a = ha * 2.471;
  return a >= 10 ? `${Math.round(a).toLocaleString("en-IN")} acres` : `${a.toFixed(1)} acres`;
};

export const STATUS_WORDS: Record<PondStatus, { label: string; plain: string }> = {
  vanished: { label: "Gone", plain: "No water seen here at all in the last two years" },
  shrank: { label: "Shrunk", plain: "Less than half of it still holds water" },
  alive: { label: "Still there", plain: "Still holds water after the monsoon" },
  came_back: { label: "Water came back", plain: "Dry a few years ago, holding water now" },
};

export const POND_COLOUR: Record<PondStatus, string> = {
  vanished: "#c2410c", shrank: "#b7791f", alive: "#1e78dc", came_back: "#0f8a5f",
};

export const NOW_WORDS: Record<string, string> = {
  built_or_bare: "Now looks built over or bare ground",
  dried_grassed: "Now covered in plants (dried up, or water hidden under weeds)",
  unclear: "Hard to tell what is there now",
};

// ---- Cases

export const STAGES = ["adopted", "sent", "answered", "inspected", "work_started", "water_back"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_WORDS: Record<Stage, { label: string; who: string; next: string }> = {
  adopted: { label: "Adopted", who: "A local group took charge of this pond", next: "Send the letter to the agency, then mark it sent" },
  sent: { label: "Letter sent", who: "The agency has the letter; the 30-day clock is running", next: "Mark it when the agency answers" },
  answered: { label: "Agency answered", who: "The agency replied", next: "Mark it when officials inspect the pond" },
  inspected: { label: "Inspected", who: "Officials visited the pond", next: "Mark it when cleaning or digging starts" },
  work_started: { label: "Work started", who: "Cleaning, digging or clearing has begun", next: "Mark it when the pond holds water again" },
  water_back: { label: "Water back", who: "The group says water is back. The satellite checks this.", next: "" },
};

export const AGENCIES: Record<string, { label: string; to: (district?: string | null) => string }> = {
  dda: { label: "Delhi Development Authority (DDA)", to: () => "The Vice Chairman, Delhi Development Authority (DDA), Vikas Sadan, INA, New Delhi" },
  mcd: { label: "Municipal Corporation of Delhi (MCD)", to: () => "The Commissioner, Municipal Corporation of Delhi (MCD), Civic Centre, Minto Road, New Delhi" },
  djb: { label: "Delhi Jal Board (DJB)", to: () => "The Chief Executive Officer, Delhi Jal Board, Varunalaya Phase II, Karol Bagh, New Delhi" },
  pwd: { label: "Public Works Department (PWD)", to: () => "The Engineer-in-Chief, Public Works Department, Government of NCT of Delhi" },
  ifc: { label: "Irrigation and Flood Control Department", to: () => "The Chief Engineer, Irrigation and Flood Control Department, Government of NCT of Delhi" },
  forest: { label: "Forest Department", to: () => "The Principal Chief Conservator of Forests, Department of Forests and Wildlife, Government of NCT of Delhi" },
  revenue: { label: "Revenue Department (District Magistrate)", to: (d) => `The District Magistrate${d ? `, ${d} district` : ""}, Revenue Department, Government of NCT of Delhi` },
  unsure: { label: "Not sure: send to the District Magistrate", to: (d) => `The District Magistrate${d ? `, ${d} district` : ""}, Revenue Department, Government of NCT of Delhi` },
};

export const ADOPTERS: Record<string, string> = {
  rwa: "Resident welfare association (RWA)",
  school: "School",
  college: "College or NSS unit",
  company: "Company",
  ngo: "Non-profit group",
  person: "Just me",
};

export const WETLAND_AUTHORITY = "The Member Secretary, Wetland Authority of Delhi, Department of Environment, Government of NCT of Delhi";

export type SpaceCheck = {
  checked: string;
  window: [string, string];
  verdict: "water" | "some_water" | "dry" | "no_clear_look";
  wet_share?: number;
  latest_clear?: string;
  clear_passes?: number;
  photo_url?: string;
  passes: { date: string; clear: number; wet?: number }[];
};

export type PondCase = {
  pond_id: string;
  city: string;
  name: string | null;
  kind: string | null;
  agency: string | null;
  district: string | null;
  stage: Stage | null;
  created: string | null;
  history: { stage: Stage; at: string; note?: string }[];
  checks: SpaceCheck[];
  check_status?: "running" | "done" | "error" | null;
  waiting_days?: number;
  overdue?: boolean;
  space?: { verdict: SpaceCheck["verdict"]; date?: string; wet_share?: number };
  revived?: boolean;
  claim_not_seen?: boolean;
};

export const SPACE_WORDS: Record<SpaceCheck["verdict"], string> = {
  water: "Water seen from space",
  some_water: "A little water seen from space",
  dry: "No water seen from space",
  no_clear_look: "No clear look from space yet (clouds)",
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!PLOT_API_URL) throw new Error("No API is set up for this site.");
  const res = await fetch(`${PLOT_API_URL}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `The server answered ${res.status}`), { body });
  return body as T;
}

export const getCases = () => call<{ cases: PondCase[]; answer_days: number }>("/ponds/cases");
export const getCase = (id: string) => call<{ case: PondCase | null }>(`/ponds/${id}`);
export const adoptPond = (id: string, name: string, kind: string, agency: string) =>
  call<{ case: PondCase; key: string }>(`/ponds/${id}/adopt`, { method: "POST", body: JSON.stringify({ name, kind, agency }) });
export const moveStage = (id: string, key: string, stage: Stage, note: string) =>
  call<{ case: PondCase }>(`/ponds/${id}/stage`, { method: "POST", body: JSON.stringify({ key, stage, note }) });
export const checkFromSpace = (id: string) => call<{ check_status: string; fresh?: boolean }>(`/ponds/${id}/check`, { method: "POST" });

// The adopter's key stays in this browser only; it is what lets them move the case forward.
export function savedKey(id: string): string | null {
  try {
    return localStorage.getItem(`jalrekha-pond-key-${id}`);
  } catch {
    return null;
  }
}
export function saveKey(id: string, key: string) {
  try {
    localStorage.setItem(`jalrekha-pond-key-${id}`, key);
  } catch {
    /* private window: the key is also shown once to copy */
  }
}

// ---- Letters

export const mapLink = (p: PondProps) => `https://www.google.com/maps?q=${p.lat},${p.lon}`;
const today = () => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

function pondLine(p: PondProps, i?: number) {
  return `${i !== undefined ? `${i + 1}. ` : ""}Pond ${p.id}${p.district ? ` (${p.district} district)` : ""}: about ${acres(p.area_ha)}, ` +
    `at ${p.lat}, ${p.lon} (${mapLink(p)}). ${STATUS_WORDS[p.status].plain}. ${NOW_WORDS[p.now ?? "unclear"] ?? ""}.`;
}

/** The letter an adopter sends to the agency that owns the land, copied to the Wetland Authority. */
export function agencyLetter(p: PondProps, s: PondSummary, c: { name: string; kind: string; agency: string }, caseUrl: string) {
  const a = AGENCIES[c.agency] ?? AGENCIES.unsure;
  const unsure = c.agency === "unsure";
  return `To,
${a.to(p.district)}

Copy to: ${WETLAND_AUTHORITY}

Date: ${today()}

Subject: Request to revive a lost pond${p.district ? ` in ${p.district} district` : ""}, and our offer to help

Sir / Madam,

We, ${c.name} (${ADOPTERS[c.kind] ?? "local residents"}), have adopted the pond below and want to help bring it back.

${pondLine(p)}

Free satellite photos from the European Space Agency's Sentinel-2 satellite show it held water after the monsoon in ${s.baseline_years.join(", ")}, but ${p.status === "vanished" ? "held no water" : "held much less water"} in ${s.recent_years.join(" and ")}.

${unsure ? "We could not find out which agency owns this land. As the keeper of the land records, please tell us who owns it and forward this letter to them.\n\n" : ""}We request you to:

1. Tell us whether this pond is on the Wetland Authority of Delhi's list of water bodies, and its unique ID. If it is not on the list, please add it.
2. Inspect the pond within 30 days, and record what has happened to it.
3. Include it in your plan to revive water bodies, and tell us the expected dates.
4. If it has been filled or built over, tell us what action will be taken.

We offer to help: volunteers for cleaning and watching over the pond, and help finding company CSR money for the work, with your permission.

You can follow this pond's progress, and what the satellite sees each month, here: ${caseUrl}

Please reply within 30 days.

Yours faithfully,
${c.name}
[Contact person, address and phone number]

Made with JalRekha (satellite data: Copernicus Sentinel-2, via AWS Open Data).
`;
}

/** A one-page project note a group can take to a company's CSR team. */
export function csrProposal(p: PondProps, s: PondSummary, c: { name: string; agency: string }, caseUrl: string) {
  const a = AGENCIES[c.agency] ?? AGENCIES.unsure;
  return `PROJECT NOTE: Revive pond ${p.id}, Delhi

Proposed by: ${c.name}
Date: ${today()}

1. The site
${pondLine(p)}
Land-owning agency: ${a.label}${c.agency === "unsure" ? " (to be confirmed by the District Magistrate)" : ""}.

2. The problem
Satellite photos show this pond held water after the monsoon in ${s.baseline_years.join(", ")}, and ${p.status === "vanished" ? "none" : "much less"} in ${s.recent_years.join(" and ")}. Lost ponds mean less rain soaking into the ground, lower ground water and more flooded streets nearby.

3. The work (to be confirmed after the agency inspects)
- Remove rubbish, silt and weeds so the pond can hold water again.
- Clear the drains and channels that bring rain water into it.
- Stop sewage and dumping, and fence the edge where needed.
- Plant native trees and grasses on the banks.

4. Why it qualifies for CSR
Schedule VII of the Companies Act, 2013, item (iv): ensuring environmental sustainability, conservation of natural resources and maintaining quality of soil, air and water.

5. Permission
The work needs written permission from the land-owning agency. ${c.name} has written to them; the case is public here: ${caseUrl}

6. How success is measured
Water held after the next monsoon, checked independently from space by JalRekha with free Sentinel-2 satellite photos, every month, on a public page.

7. Cost
To be estimated with the land-owning agency after inspection.

Contact: ${c.name}, [contact person, phone, email]
`;
}

/** One letter for many ponds, to the Wetland Authority (from the list page). */
export function authorityLetter(list: PondProps[], s: PondSummary) {
  const first = s.baseline_years.join(", "), last = s.recent_years.join(" and ");
  return `To,
${WETLAND_AUTHORITY}

Date: ${today()}

Subject: Request to inspect ${list.length === 1 ? "a water body" : `${list.length} water bodies`} in Delhi that held water in ${first} but not in ${last}

Sir / Madam,

Free satellite photos from the European Space Agency's Sentinel-2 satellite show that the water ${list.length === 1 ? "body" : "bodies"} listed below held water in the months after the monsoon (November to January) in at least two of the years ${first}, but held little or no water in ${last}.

${list.map(pondLine).join("\n")}

Under the Wetlands (Conservation and Management) Rules, 2017, I request you to:

1. Tell me which of these are on the Authority's list of water bodies, with their unique IDs, and add the ones that are not.
2. Direct the land-owning agencies to inspect them and record what has happened to each.
3. Include them in the plan to revive Delhi's water bodies.
4. Where one has been filled or built over, tell me what action will be taken.

A satellite photo cannot replace a site visit. Some ponds fill only in wet years, so a pond may look dry for natural reasons. I am asking for an inspection, not making an accusation.

Please reply within 30 days.

Yours faithfully,
[Your name]
[Your address and phone number]

Made with JalRekha (satellite data: Copernicus Sentinel-2, via AWS Open Data). Results made on ${s.made}.
`;
}

export function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Geometry, for Plot Check's pond warning

function inRing([x, y]: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from a point to the nearest edge of a polygon (0 when inside). */
export function distanceToPond(lon: number, lat: number, geom: GeoJSON.Geometry): number {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110540;
  let best = Infinity;
  for (const rings of polys as number[][][][]) {
    if (inRing([lon, lat], rings[0]) && !rings.slice(1).some((h) => inRing([lon, lat], h))) return 0;
    for (const ring of rings) {
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lon) * kx, ay = (ring[i - 1][1] - lat) * ky;
        const bx = (ring[i][0] - lon) * kx, by = (ring[i][1] - lat) * ky;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}
