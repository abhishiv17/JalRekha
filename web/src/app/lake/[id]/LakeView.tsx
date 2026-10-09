"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AreaChart from "@/components/AreaChart";
import type { Layers } from "@/components/LakeMap";
import { Guide, Loader } from "@/components/Mascot";
import { Outlines } from "@/components/OutlinedImage";
import Swipe from "@/components/Swipe";
import WatchForm from "@/components/WatchForm";
import { ANALYSED_META, KIND_LABELS, placeLabel } from "@/lib/catalog";
import {
  type FeatureCollection,
  type FlagProps,
  type Stats,
  drySeasons,
  kindLabel,
  lakeUrl,
  loadBounds,
  loadFlags,
  loadReference,
  loadStats,
  seasonLabel,
} from "@/lib/data";

const LakeMap = dynamic(() => import("@/components/LakeMap"), { ssr: false });

type Loaded = {
  stats: Stats;
  flags: FeatureCollection<FlagProps>;
  reference: FeatureCollection<{ kind: "reference" | "buffer"; width_m?: number }>;
  bounds: [number, number, number, number];
};

const BASELINE = ["2019", "2020"];
const yearOf = (season: string) => season.slice(0, 4);
const ac = (n: number) => `${n.toFixed(2)} acres`;

// How sure, from the pipeline's confidence (pipeline/jalrekha/change.py).
const SURE: Record<string, string> = { high: "Sure", medium: "Fairly sure", low: "Not sure yet" };

// A person compared the spot with older high-resolution photos (research/flags_checked.csv).
type HandCheck = { verdict: string; seen: string; dates: string; source: string };
const CHECKED: Record<string, string> = {
  confirmed: "Yes: lake really lost",
  "not confirmed": "Yes: no loss found",
  "can't tell": "Yes: unclear",
};

export default function LakeView({ id }: { id: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layers>({ flags: true, outline: true, buffer: true, landcover: false, water: true });
  const [bufferWidth, setBufferWidth] = useState(30);
  const [focusFlag, setFocusFlag] = useState<string | null>(null);
  const [zoomTo, setZoomTo] = useState<string | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  // What Jal last reacted to; drives the narration next to the map.
  const [checks, setChecks] = useState<Record<string, HandCheck>>({});
  const [said, setSaid] = useState<{ kind: "intro" | "season" | "flag" | "buffer" | "landcover"; ref?: string | number }>({ kind: "intro" });

  useEffect(() => {
    fetch("/hand-checks.json").then((r) => r.json()).then(setChecks).catch(() => setChecks({}));
  }, []);

  // A failed image belongs to one season; clear the notice when the season changes.
  useEffect(() => setMapError(null), [season]);

  useEffect(() => {
    Promise.all([loadStats(id), loadFlags(id), loadReference(id), loadBounds(id)])
      .then(([stats, flags, reference, b]) => {
        setData({ stats, flags, reference, bounds: b.bounds });
        const usable = drySeasons(stats).filter((s) => s.status === "ok");
        setSeason(usable.at(-1)?.season ?? null);
        setBefore(usable[0]?.season ?? null);
        setAfter(usable.at(-1)?.season ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  const dry = useMemo(() => (data ? drySeasons(data.stats) : []), [data]);
  const usable = dry.filter((s) => s.status === "ok");

  if (error) {
    return (
      <main>
        <p className="notice error">This lake&apos;s results could not be loaded ({error}).</p>
        <Link href="/lakes/">Back to all lakes</Link>
      </main>
    );
  }
  if (!data || !season) return <main><Loader label="Pulling up every dry season since 2019…" /></main>;

  const { stats, flags, reference, bounds } = data;
  const place = ANALYSED_META[id];
  const sel = dry.find((s) => s.season === season)!;
  const fs = flags.features.map((f) => f.properties);
  const total = stats.flags_total_ac;
  const pct = stats.reference_area_ac ? (total / stats.reference_area_ac) * 100 : 0;
  const byKind = Object.keys(KIND_LABELS).map((k) => ({
    k, label: KIND_LABELS[k], area: fs.filter((f) => (f.kind ?? "fill_or_construction") === k).reduce((a, f) => a + f.area_ac, 0),
  })).filter((x) => x.area > 0);
  const seasonsSeen = fs.map((f) => f.first_seen).sort();
  const earliest = seasonsSeen[0];
  const confirmed = fs.filter((f) => f.status === "confirmed");
  const conf = (["high", "medium", "low"] as const).map((c) => ({ c, n: fs.filter((f) => f.confidence === c).length }));
  const bufferFlags = fs.filter((f) => f.zone === "buffer");
  const bill = stats.buffer.bill_2025_m;
  const inBuffer = stats.buffer.change_in_buffer_ac[String(bufferWidth)] ?? 0;
  const postBaseline = usable.filter((s) => !BASELINE.includes(yearOf(s.season)));
  const enoughData = postBaseline.length >= 2;
  const status = !enoughData ? "nodata" : total > 0 ? "changed" : "steady";
  const statusText = status === "nodata" ? "Not enough clear photos" : status === "changed" ? "Lake is shrinking" : "Lake looks stable";
  const last = usable.at(-1)!.season;

  const narration = (() => {
    const base = usable[0];
    const baseYear = base ? yearOf(base.season) : "2019";
    const earliestYear = earliest ? yearOf(earliest) : null;
    if (said.kind === "flag") {
      const f = fs.find((x) => x.flag_id === said.ref);
      if (f) {
        const n = f.flag_id.split("-").at(-1);
        const what = f.kind === "vegetated_land" ? "lake bed that dried up and grassed over" : "soil dumped or built on";
        const where = f.zone === "buffer" ? "within 30 metres of the lake, where building is not allowed" : "inside the lake";
        const hand = checks[f.flag_id];
        return `Spot ${n}: ${ac(f.area_ac)} of ${what}, ${where}. I first saw it in ${yearOf(f.first_seen)}${
          f.status === "confirmed" ? ", and it stayed land the next year too" : ". It has been land in only one year so far, so it needs another look next year"
        }. ${SURE[f.confidence]}.${hand ? ` A person checked it: ${CHECKED[hand.verdict] ?? hand.verdict}. They saw: ${hand.seen}` : ""}`;
      }
    }
    if (said.kind === "buffer") {
      return bufferWidth === 30
        ? `The law says nothing may be built within 30 metres of a lake. ${inBuffer > 0 ? `${ac(inBuffer)} of the change I found is inside that zone.` : "None of the change I found is in that zone; it's all inside the lake."}`
        : `A proposed rule would shrink the zone to ${bufferWidth} metres here. It isn't law yet. ${inBuffer > 0 ? `${ac(inBuffer)} of the change is inside that smaller zone.` : "None of the change is inside that smaller zone."}`;
    }
    if (said.kind === "landcover") {
      return "Blue is open water, green is weeds floating on water (still lake), red is bare soil or buildings.";
    }
    if (said.kind === "season") {
      const label = seasonLabel(season);
      const lake = `${ac(sel.water_ac ?? 0)} of open water and ${ac(sel.floating_veg_ac ?? 0)} of weeds on water`;
      if (BASELINE.includes(yearOf(season))) {
        return `${yearOf(season)} is my starting point: ${lake}. Both count as lake. I compare every later year with this.`;
      }
      const g = sel.land_veg_ac ?? 0, g0 = base?.land_veg_ac ?? 0, b = sel.bare_built_ac ?? 0, b0 = base?.bare_built_ac ?? 0;
      const shifts = [
        g - g0 >= 0.2 ? `${ac(g)} of the lake bed is now grass, up from ${ac(g0)} in ${baseYear}` : null,
        b - b0 >= 0.2 ? `${ac(b)} is bare soil or buildings, up from ${ac(b0)}` : null,
      ].filter(Boolean);
      const flagNote = earliestYear
        ? Number(yearOf(season)) < Number(earliestYear)
          ? ` The orange patches are still lake in ${yearOf(season)}; they turn to land from ${earliestYear}.`
          : ` Orange marks the parts that had turned to land by ${earliestYear}.`
        : "";
      return `${label}: ${lake}. ${shifts.length ? `${shifts.join("; ")}.` : `Not much more grass or bare soil than in ${baseYear}.`}${flagNote}`;
    }
    if (status === "nodata") return "There were too many cloudy years here to judge this lake yet.";
    if (total > 0) {
      return `I looked at this lake every year since 2019. ${ac(total)} of it has turned into land. Pick a year below to watch it happen, or tap an orange spot in the list to fly there.`;
    }
    return `I looked at this lake every year since 2019, and none of it turned into land. Pick a year and see for yourself.`;
  })();

  const zoom = (flagId: string) => {
    setSaid({ kind: "flag", ref: flagId });
    setZoomTo(flagId);
    setFocusFlag(flagId);
    document.getElementById("lake-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const toggle = (k: keyof Layers) => {
    if (k === "landcover" && !layers.landcover) setSaid({ kind: "landcover" });
    setLayers((l) => ({ ...l, [k]: !l[k] }));
  };

  return (
    <main>
      <Link href="/lakes/" className="small" style={{ textDecoration: "none" }}>← All lakes</Link>

      <div className="lake-header" style={{ marginTop: 10 }}>
        <div style={{ minWidth: 0, flex: "1 1 560px" }}>
          <span className="eyebrow">How this lake changed</span>
          <h1>{stats.name}</h1>
          <div className="row" style={{ gap: 10 }}>
            {place && <span className="lede">{placeLabel(place)}</span>}
            <span className={`pill ${status}`}>{statusText}</span>
          </div>
          <p className="summary-line">
            {status === "nodata" ? (
              <>Too many cloudy years to judge this lake yet.</>
            ) : total > 0 ? (
              <>
                <strong>{ac(total)}</strong> ({pct.toFixed(1)}% of the lake) has turned into land since 2019
                {byKind.length > 0 && <>: {byKind.map((x, i) => <span key={x.k}>{i ? " and " : ""}{ac(x.area)} {x.label.toLowerCase()}</span>)}</>}.
                {earliest && <> First seen in {yearOf(earliest)}.</>}
              </>
            ) : (
              <>None of the lake, or the 30 metres around it, turned into land between 2019 and {yearOf(last)}.</>
            )}
          </p>
          <div className="periods">
            <span>Starting point: 2019–2020</span>
            <span>Checked up to: {yearOf(last)}</span>
            <span>Clear photos in {usable.length} of {dry.length} years</span>
            <span>Updated {stats.as_of}</span>
          </div>
        </div>
        <div className="row no-print" style={{ gap: 10 }}>
          <Link className="button" href={`/lake/${id}/evidence/`}>Download proof</Link>
          <a className="button secondary" href="#watch">Watch this lake</a>
        </div>
      </div>
      {stats.sample && <p className="notice">Sample data, not real results.</p>}
      {place?.note && <p className="notice"><strong>Read this first:</strong> {place.note}</p>}

      <div className="grid2" style={{ marginTop: 20 }}>
        <section id="lake-map" aria-label="Satellite map">
          <div className="map-wrap">
            <LakeMap
              bounds={bounds}
              // ?map=1: a cache entry of its own, so a copy cached by a plain <img> can't block the map.
              imageUrl={`${lakeUrl(id, `truecolor/${season}.png`)}?map=1`}
              overlayUrl={`${lakeUrl(id, `overlay/${season}.png`)}?map=1`}
              waterUrl={`${lakeUrl(id, `water/${season}.geojson`)}?map=1`}
              layers={layers}
              flags={flags}
              reference={reference}
              bufferWidth={bufferWidth}
              focusFlag={focusFlag}
              zoomTo={zoomTo}
              onError={setMapError}
            />
            <div className="map-badge" aria-live="polite">
              <strong>{seasonLabel(season)}</strong>
              <div className="muted small">Satellite photo, Jan–Apr {yearOf(season)} ({sel.clear_looks} clear days combined)</div>
            </div>
          </div>
          {mapError && <p className="notice error">{mapError}</p>}
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            From space, most city lakes look green or brown, not blue: weeds, algae and silt cover the water. Blue on the
            map is the open water we measured that year.
          </p>

          <div className="card" style={{ marginTop: 12 }}>
            <Guide size={50}>{narration}</Guide>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
              <strong>Pick a year (January to April)</strong>
              {zoomTo && (
                <button type="button" className="ghost" onClick={() => { setZoomTo(null); setFocusFlag(null); setSaid({ kind: "intro" }); }}>Show whole lake</button>
              )}
            </div>
            <div className="timeline" role="group" aria-label="Choose a year">
              {dry.map((s) => {
                const ok = s.status === "ok";
                const tag = BASELINE.includes(yearOf(s.season)) ? "start" : ok ? "checked" : "too cloudy";
                return (
                  <button key={s.season} type="button" aria-pressed={s.season === season} disabled={!ok}
                    title={ok ? seasonLabel(s.season) : `${seasonLabel(s.season)}: not enough clear images`}
                    onClick={() => { setSeason(s.season); setSaid({ kind: "season", ref: s.season }); }}>
                    {yearOf(s.season)}
                    <small>{tag}</small>
                  </button>
                );
              })}
            </div>
            <dl className="season-stats" aria-label={`Lake footprint cover in ${seasonLabel(season)}`}>
              <div><dt><i className="legend-key" style={{ background: "var(--water)" }} />Open water</dt><dd>{ac(sel.water_ac ?? 0)}</dd></div>
              <div><dt><i className="legend-key" style={{ background: "var(--veg)" }} />Weeds on water</dt><dd>{ac(sel.floating_veg_ac ?? 0)}</dd></div>
              <div><dt><i className="legend-key" style={{ background: "var(--land)" }} />Lake bed now grass</dt><dd>{ac(sel.land_veg_ac ?? 0)}</dd></div>
              <div><dt><i className="legend-key" style={{ background: "var(--bare)" }} />Bare soil or buildings</dt><dd>{ac(sel.bare_built_ac ?? 0)}</dd></div>
            </dl>
            <fieldset className="layers" style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
              <legend className="sr-only">Map layers</legend>
              <label><input type="checkbox" checked={layers.water} onChange={() => toggle("water")} />
                <span><i className="legend-key" style={{ background: "#1e78dc" }} />Open water</span></label>
              <label><input type="checkbox" checked={layers.flags} onChange={() => toggle("flags")} />
                <span><i className="legend-key" style={{ border: "2px solid var(--flag)", background: "rgba(245,165,36,.25)" }} />Where the lake was lost</span></label>
              <label><input type="checkbox" checked={layers.outline} onChange={() => toggle("outline")} />
                <span><i className="legend-key" style={{ border: "2px solid #fff", background: "#8a958f" }} />Lake outline</span></label>
              <label><input type="checkbox" checked={layers.buffer} onChange={() => toggle("buffer")} />
                <span><i className="legend-key" style={{ border: "2px dashed #8fbf9f" }} />{bufferWidth}-metre no-build zone</span></label>
              <label><input type="checkbox" checked={layers.landcover} onChange={() => toggle("landcover")} />
                <span>Colour every spot (water, weeds, soil)</span></label>
            </fieldset>
            {layers.landcover && (
              <div className="legend">
                <span><i style={{ background: "var(--water)" }} />Open water</span>
                <span><i style={{ background: "var(--veg)" }} />Weeds on water (still lake)</span>
                <span><i style={{ background: "var(--bare)" }} />Bare soil or buildings</span>
              </div>
            )}
          </div>
        </section>

        <section aria-label="Findings" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>What changed</h2>
            <dl className="season-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 16px" }}>
              <div><dt>Lake lost</dt><dd className="stat" style={{ color: total ? "var(--amber-ink)" : undefined }}>{ac(total)}</dd></div>
              <div><dt>Share of the lake</dt><dd className="stat">{pct.toFixed(1)}%</dd></div>
              <div><dt>Lake size in 2019–2020</dt><dd>{ac(stats.reference_area_ac)}</dd></div>
              <div><dt>First noticed</dt><dd>{earliest ? yearOf(earliest) : "—"}</dd></div>
              <div><dt>Spots that lasted 2+ years</dt><dd>{confirmed.length} of {fs.length}</dd></div>
              <div><dt>How sure</dt><dd>{conf.filter((x) => x.n).map((x) => `${x.n} ${SURE[x.c].toLowerCase()}`).join(" · ") || "—"}</dd></div>
            </dl>
            {byKind.length > 0 && (
              <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none" }}>
                {byKind.map((x) => (
                  <li key={x.k} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                    <span>{x.label}</span><strong>{ac(x.area)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted" style={{ margin: "12px 0 0" }}>
              1 acre is about half a football field. A spot seen as land in only one year could just be a dry year, so it needs another look.
            </p>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>No-build zone around the lake</h2>
            <div className="segmented" role="group" aria-label="Zone width" style={{ width: "fit-content" }}>
              <button type="button" aria-pressed={bufferWidth === 30} onClick={() => { setBufferWidth(30); setSaid({ kind: "buffer", ref: 30 }); }}>30 metres · the law today</button>
              {bill > 0 && bill !== 30 && (
                <button type="button" aria-pressed={bufferWidth === bill} onClick={() => { setBufferWidth(bill); setSaid({ kind: "buffer", ref: bill }); }}>{bill} metres · proposed rule</button>
              )}
            </div>
            <p style={{ margin: "14px 0 6px" }}>
              <span className="stat">{ac(inBuffer)}</span>{" "}
              <span className="muted">of change inside the {bufferWidth}-metre zone</span>
            </p>
            {bufferWidth === 30 && bufferFlags.length > 0 && (
              <p className="small" style={{ margin: "0 0 6px" }}>
                {bufferFlags.length} {bufferFlags.length === 1 ? "spot" : "spots"} in the zone: {Array.from(new Set(bufferFlags.map((f) => kindLabel(f.kind).toLowerCase()))).join(", ")}.
              </p>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              {bufferWidth === 30
                ? "Karnataka's lake law (KTCDA Act, 2014) bans building within 30 metres of a lake."
                : `A 2025 change to the law would allow building up to ${bill} metres from a lake this size. It is not law yet (as of ${stats.as_of}).`}{" "}
              This is not a legal ruling.
            </p>
          </div>
        </section>
      </div>

      {before && after && usable.length > 1 && (
        <section aria-labelledby="compare-title">
          <h2 id="compare-title">Compare two years</h2>
          <div className="card">
            <div className="compare">
              <div className="field">
                <label htmlFor="before">Before</label>
                <select id="before" value={before} onChange={(e) => setBefore(e.target.value)}>
                  {usable.map((s) => <option key={s.season} value={s.season} disabled={s.season === after}>{seasonLabel(s.season)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="after">After</label>
                <select id="after" value={after} onChange={(e) => setAfter(e.target.value)}>
                  {usable.map((s) => <option key={s.season} value={s.season} disabled={s.season === before}>{seasonLabel(s.season)}</option>)}
                </select>
              </div>
            </div>
            <Guide size={44} className="guide-compare">
              {`Drag the white line: left is ${yearOf(before)}, right is ${yearOf(after)}. White is the lake's edge; orange is where the lake turned into land.`}
            </Guide>
            <div style={{ maxWidth: 760, margin: "16px auto 0" }}>
              <Swipe
                before={lakeUrl(id, `truecolor/${before}.png`)}
                after={lakeUrl(id, `truecolor/${after}.png`)}
                beforeLabel={seasonLabel(before)}
                afterLabel={seasonLabel(after)}
                overlay={<Outlines bounds={bounds} reference={reference} flags={layers.flags ? flags : undefined} />}
              />
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>Same place and size on both sides.</p>
          </div>
        </section>
      )}

      <h2>Places where the lake was lost</h2>
      <div className="card">
        {fs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>None found. The lake has kept its size since 2019.</p>
        ) : (
          <div className="table-scroll"><table>
            <thead>
              <tr><th>Spot</th><th>Where</th><th>What happened</th><th className="num">Size</th><th>First seen</th><th>Lasted?</th><th>How sure</th><th>Checked by a person</th></tr>
            </thead>
            <tbody>
              {fs.map((f) => (
                <tr key={f.flag_id} className={`clickable${zoomTo === f.flag_id ? " active" : ""}`} tabIndex={0}
                  title="Show this spot on the map"
                  onClick={() => zoom(f.flag_id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), zoom(f.flag_id))}
                  onMouseEnter={() => setFocusFlag(f.flag_id)} onMouseLeave={() => setFocusFlag(zoomTo)}>
                  <td>{f.flag_id.split("-").at(-1)}</td>
                  <td>{f.zone === "lakebed" ? "Inside the lake" : "Within 30 metres of the lake"}</td>
                  <td>{kindLabel(f.kind)}</td>
                  <td className="num">{ac(f.area_ac)}</td>
                  <td>{yearOf(f.first_seen)}</td>
                  <td>{f.status === "confirmed" ? "Yes, 2+ years" : "Only 1 year so far"}</td>
                  <td><span className={`pill ${f.confidence}`}>{SURE[f.confidence]}</span></td>
                  <td title={checks[f.flag_id]?.seen}>{checks[f.flag_id] ? CHECKED[checks[f.flag_id].verdict] ?? checks[f.flag_id].verdict : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <dl className="explain small">
          <div><dt>Lasted?</dt><dd><b>Yes, 2+ years</b>: the spot was land in two or more dry seasons in a row. <b>Only 1 year so far</b>: land in the latest year only; it could be a dry year.</dd></div>
          <div><dt>How sure</dt><dd><b>Sure</b>: land 2+ years in a row, and still land after every monsoon since. <b>Fairly sure</b>: land 2+ years, but water came back after some monsoons. <b>Not sure yet</b>: land in one year only.</dd></div>
          <div><dt>Checked by a person</dt><dd>A team member compared the spot with older, sharper photos (Google Earth). Hover or tap a spot to read what they saw. Every other spot still needs a check.</dd></div>
        </dl>
        <p className="small muted" style={{ marginBottom: 0 }}>Tap a row to see the spot on the map. A satellite sees change, not who did it, so check on the ground before blaming anyone.</p>
      </div>

      <h2>The lake, year by year</h2>
      <div className="card">
        <AreaChart seasons={dry} selected={season} />
      </div>

      <details className="method">
        <summary>How we worked this out (technical details)</summary>
        <dl>
          <dt>Imagery</dt><dd>Sentinel-2 Level-2A (10 metres), {dry.reduce((a, s) => a + s.scene_ids.length, 0)} dry-season scenes from 2019 to 2026, via Earth Search on AWS Open Data.</dd>
          <dt>Baseline</dt><dd>Dry seasons 2019 and 2020. The reference footprint is the mapped outline plus water present in both baseline seasons.</dd>
          <dt>Classification</dt><dd>Water: MNDWI above a per-lake Otsu threshold (never below {stats.thresholds.mndwi}). Vegetation: NDVI ≥ {stats.thresholds.veg_ndvi}; floating if its shortwave infrared stays low. Bare or built: NDVI &lt; {stats.thresholds.bare_ndvi} and NDBI &gt; {stats.thresholds.ndbi}.</dd>
          <dt>Persistence</dt><dd>Lake bed that was lake in every baseline season and is land in its latest dry seasons; two in a row is confirmed.</dd>
          <dt>Minimum area</dt><dd>{stats.thresholds.min_flag_px} connected pixels ({stats.thresholds.min_flag_px * 100} m²).</dd>
          <dt>Data quality</dt><dd>{usable.length} of {dry.length} dry seasons had at least 3 clear looks per pixel; others are shown as no data.</dd>
          <dt>Verification</dt><dd>Check each flag against high-resolution historical imagery, on the ground and in official records. Legal works also appear as change.</dd>
        </dl>
      </details>

      <section id="watch" className="card" style={{ marginTop: 24 }} aria-label="Act on these results">
        <div className="split" style={{ gap: 24, alignItems: "flex-start" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Help save this lake</h2>
            <p className="small" style={{ color: "var(--body)" }}>
              Download dated satellite photos and map points of every spot, with a ready complaint letter and a
              Right to Information (RTI) request to send to the city.
            </p>
            <Link className="button" href={`/lake/${id}/evidence/`}>Download proof and letters</Link>
          </div>
          <WatchForm lake={id} name={stats.name} />
        </div>
      </section>
    </main>
  );
}
