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
const ac = (n: number) => `${n.toFixed(2)} ac`;

export default function LakeView({ id }: { id: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layers>({ flags: true, outline: true, buffer: true, landcover: false });
  const [bufferWidth, setBufferWidth] = useState(30);
  const [focusFlag, setFocusFlag] = useState<string | null>(null);
  const [zoomTo, setZoomTo] = useState<string | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  // What Jal last reacted to; drives the narration next to the map.
  const [said, setSaid] = useState<{ kind: "intro" | "season" | "flag" | "buffer" | "landcover"; ref?: string | number }>({ kind: "intro" });

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
  const fresh = fs.filter((f) => f.status !== "confirmed");
  const conf = (["high", "medium", "low"] as const).map((c) => ({ c, n: fs.filter((f) => f.confidence === c).length }));
  const bufferFlags = fs.filter((f) => f.zone === "buffer");
  const bill = stats.buffer.bill_2025_m;
  const inBuffer = stats.buffer.change_in_buffer_ac[String(bufferWidth)] ?? 0;
  const postBaseline = usable.filter((s) => !BASELINE.includes(yearOf(s.season)));
  const enoughData = postBaseline.length >= 2;
  const status = !enoughData ? "nodata" : total > 0 ? "changed" : "steady";
  const statusText = status === "nodata" ? "Not enough data" : status === "changed" ? "Change detected" : "No change detected";
  const last = usable.at(-1)!.season;

  const narration = (() => {
    const base = usable[0];
    const baseYear = base ? yearOf(base.season) : "2019";
    const earliestYear = earliest ? yearOf(earliest) : null;
    if (said.kind === "flag") {
      const f = fs.find((x) => x.flag_id === said.ref);
      if (f) {
        const n = f.flag_id.split("-").at(-1);
        const what = f.kind === "vegetated_land" ? "lake bed that is now grassed land" : "fill or construction";
        const where = f.zone === "buffer" ? "in the 30 m buffer" : "inside the lake bed";
        return `Flag ${n}: ${ac(f.area_ac)} of ${what}, ${where}. I first saw it in the ${yearOf(f.first_seen)} dry season${
          f.status === "confirmed" ? " and it was still there the next dry season, so it's confirmed" : ", and it has only been there one dry season so far, so it's new"
        }. Confidence: ${f.confidence}.`;
      }
    }
    if (said.kind === "buffer") {
      return bufferWidth === 30
        ? `The law in force protects 30 m around every lake. ${inBuffer > 0 ? `${ac(inBuffer)} of the change I flagged sits inside that ring.` : "None of the change I flagged sits inside that ring; it's all in the lake bed."}`
        : `The proposed rule would protect only ${bufferWidth} m here, and it isn't law yet. ${inBuffer > 0 ? `${ac(inBuffer)} of flagged change falls inside that narrower ring.` : "None of the flagged change falls inside that narrower ring."}`;
    }
    if (said.kind === "landcover") {
      return "Now every pixel is coloured: blue is open water, green is floating weeds (still lake), red is bare or built land.";
    }
    if (said.kind === "season") {
      const label = seasonLabel(season);
      const lake = `${ac(sel.water_ac ?? 0)} of open water and ${ac(sel.floating_veg_ac ?? 0)} of floating weeds`;
      if (BASELINE.includes(yearOf(season))) {
        return `${label} is part of my baseline: ${lake}. I count both as lake, and compare every later year against this.`;
      }
      const g = sel.land_veg_ac ?? 0, g0 = base?.land_veg_ac ?? 0, b = sel.bare_built_ac ?? 0, b0 = base?.bare_built_ac ?? 0;
      const shifts = [
        g - g0 >= 0.2 ? `${ac(g)} of lake bed is grassed land, up from ${ac(g0)} in ${baseYear}` : null,
        b - b0 >= 0.2 ? `${ac(b)} is bare or built, up from ${ac(b0)}` : null,
      ].filter(Boolean);
      const flagNote = earliestYear
        ? Number(yearOf(season)) < Number(earliestYear)
          ? ` The amber patch isn't land yet in ${yearOf(season)}; it first holds as land in ${earliestYear}.`
          : ` The amber outline marks what had turned to land by ${earliestYear}.`
        : "";
      return `${label}: ${lake}. ${shifts.length ? `${shifts.join("; ")}.` : `No big jump in grassed or bare lake bed compared with ${baseYear}.`}${flagNote}`;
    }
    if (status === "nodata") return "I don't have enough clear dry seasons after the baseline to judge this lake yet.";
    if (total > 0) {
      return `I compared ${usable.length} dry seasons here. ${ac(total)} of this lake turned to land and stayed. Pick a year below to watch it happen, or select a flag to fly to it.`;
    }
    return `I compared ${usable.length} dry seasons here, and nothing in the lake bed turned to land and stayed. Pick a year and see for yourself.`;
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
          <span className="eyebrow">Lake analysis</span>
          <h1>{stats.name}</h1>
          <div className="row" style={{ gap: 10 }}>
            {place && <span className="lede">{placeLabel(place)}</span>}
            <span className={`pill ${status}`}>{statusText}</span>
          </div>
          <p className="summary-line">
            {status === "nodata" ? (
              <>Too few clear dry seasons after the baseline to judge lasting change reliably.</>
            ) : total > 0 ? (
              <>
                <strong>{ac(total)}</strong> ({pct.toFixed(1)}% of the reference footprint) turned to land and stayed that way
                {byKind.length > 0 && <>: {byKind.map((x, i) => <span key={x.k}>{i ? " and " : ""}{ac(x.area)} {x.label.toLowerCase()}</span>)}</>}.
                {earliest && <> The earliest flag was first seen in the {seasonLabel(earliest).toLowerCase()}.</>}
              </>
            ) : (
              <>No lasting change in the lake bed or the 30 m buffer between the 2019–2020 baseline and the {seasonLabel(last).toLowerCase()}.</>
            )}
          </p>
          <div className="periods">
            <span>Baseline: dry seasons 2019–2020</span>
            <span>Compared through: {seasonLabel(last).toLowerCase()}</span>
            <span>{usable.length} of {dry.length} dry seasons with clear imagery</span>
            <span>Results as of {stats.as_of}</span>
          </div>
        </div>
        <div className="row no-print" style={{ gap: 10 }}>
          <Link className="button" href={`/lake/${id}/evidence/`}>Evidence pack</Link>
          <a className="button secondary" href="#watch">Watch this lake</a>
        </div>
      </div>
      {stats.sample && <p className="notice">Sample data, not real results.</p>}
      {place?.note && <p className="notice"><strong>Read before using these flags:</strong> {place.note}</p>}

      <div className="grid2" style={{ marginTop: 20 }}>
        <section id="lake-map" aria-label="Satellite map">
          <div className="map-wrap">
            <LakeMap
              bounds={bounds}
              imageUrl={lakeUrl(id, `truecolor/${season}.png`)}
              overlayUrl={lakeUrl(id, `overlay/${season}.png`)}
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
              <div className="muted small">Sentinel-2 median of {sel.clear_looks} clear looks, Jan–Apr {yearOf(season)}</div>
            </div>
          </div>
          {mapError && <p className="notice error">{mapError}</p>}

          <div className="card" style={{ marginTop: 12 }}>
            <Guide size={50}>{narration}</Guide>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
              <strong>Dry season</strong>
              {zoomTo && (
                <button type="button" className="ghost" onClick={() => { setZoomTo(null); setFocusFlag(null); setSaid({ kind: "intro" }); }}>Show whole lake</button>
              )}
            </div>
            <div className="timeline" role="group" aria-label="Choose a dry season">
              {dry.map((s) => {
                const ok = s.status === "ok";
                const tag = BASELINE.includes(yearOf(s.season)) ? "baseline" : ok ? "compared" : "no data";
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
              <div><dt><i className="legend-key" style={{ background: "var(--veg)" }} />Floating veg.</dt><dd>{ac(sel.floating_veg_ac ?? 0)}</dd></div>
              <div><dt><i className="legend-key" style={{ background: "var(--land)" }} />Grassed bed</dt><dd>{ac(sel.land_veg_ac ?? 0)}</dd></div>
              <div><dt><i className="legend-key" style={{ background: "var(--bare)" }} />Bare or built</dt><dd>{ac(sel.bare_built_ac ?? 0)}</dd></div>
            </dl>
            <fieldset className="layers" style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
              <legend className="sr-only">Map layers</legend>
              <label><input type="checkbox" checked={layers.flags} onChange={() => toggle("flags")} />
                <span><i className="legend-key" style={{ border: "2px solid var(--flag)", background: "rgba(245,165,36,.25)" }} />Change flags</span></label>
              <label><input type="checkbox" checked={layers.outline} onChange={() => toggle("outline")} />
                <span><i className="legend-key" style={{ border: "2px solid #fff", background: "#8a958f" }} />Lake outline</span></label>
              <label><input type="checkbox" checked={layers.buffer} onChange={() => toggle("buffer")} />
                <span><i className="legend-key" style={{ border: "2px dashed #8fbf9f" }} />{bufferWidth} m buffer</span></label>
              <label><input type="checkbox" checked={layers.landcover} onChange={() => toggle("landcover")} />
                <span>Land-cover colours (every pixel)</span></label>
            </fieldset>
            {layers.landcover && (
              <div className="legend">
                <span><i style={{ background: "var(--water)" }} />Open water</span>
                <span><i style={{ background: "var(--veg)" }} />Floating vegetation (still lake)</span>
                <span><i style={{ background: "var(--bare)" }} />Bare or built</span>
              </div>
            )}
          </div>
        </section>

        <section aria-label="Findings" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Change summary</h2>
            <dl className="season-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 16px" }}>
              <div><dt>Changed area</dt><dd className="stat" style={{ color: total ? "var(--amber-ink)" : undefined }}>{ac(total)}</dd></div>
              <div><dt>Share of footprint</dt><dd className="stat">{pct.toFixed(1)}%</dd></div>
              <div><dt>Reference footprint</dt><dd>{ac(stats.reference_area_ac)}</dd></div>
              <div><dt>Earliest first seen</dt><dd>{earliest ? seasonLabel(earliest) : "—"}</dd></div>
              <div><dt>Persistence</dt><dd>{confirmed.length} confirmed · {fresh.length} new</dd></div>
              <div><dt>Confidence</dt><dd>{conf.filter((x) => x.n).map((x) => `${x.n} ${x.c}`).join(" · ") || "—"}</dd></div>
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
              Confirmed = land in two dry seasons running; new = one season so far.
            </p>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Buffer zone</h2>
            <div className="segmented" role="group" aria-label="Buffer width" style={{ width: "fit-content" }}>
              <button type="button" aria-pressed={bufferWidth === 30} onClick={() => { setBufferWidth(30); setSaid({ kind: "buffer", ref: 30 }); }}>30 m · law in force</button>
              {bill > 0 && bill !== 30 && (
                <button type="button" aria-pressed={bufferWidth === bill} onClick={() => { setBufferWidth(bill); setSaid({ kind: "buffer", ref: bill }); }}>{bill} m · proposed</button>
              )}
            </div>
            <p style={{ margin: "14px 0 6px" }}>
              <span className="stat">{ac(inBuffer)}</span>{" "}
              <span className="muted">of flagged change inside the {bufferWidth} m ring</span>
            </p>
            {bufferWidth === 30 && bufferFlags.length > 0 && (
              <p className="small" style={{ margin: "0 0 6px" }}>
                {bufferFlags.length} buffer {bufferFlags.length === 1 ? "flag" : "flags"}: {Array.from(new Set(bufferFlags.map((f) => kindLabel(f.kind).toLowerCase()))).join(", ")}.
              </p>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              {bufferWidth === 30
                ? "Baseline: the KTCDA Act, 2014 sets a 30 m buffer around every lake."
                : `Scenario only: a 2025 amendment would set ${bill} m for a lake this size. It was returned by the Governor and is not in force (as of ${stats.as_of}).`}{" "}
              Not a legal finding.
            </p>
          </div>
        </section>
      </div>

      {before && after && usable.length > 1 && (
        <section aria-labelledby="compare-title">
          <h2 id="compare-title">Compare two dry seasons</h2>
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
              {`Drag the white line: left is the ${yearOf(before)} dry season, right is ${yearOf(after)}. White traces the lake; amber is where I found change.`}
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
            <p className="small muted" style={{ marginBottom: 0 }}>Same extent and scale on both sides; flags are from the latest analysis.</p>
          </div>
        </section>
      )}

      <h2>Change flags</h2>
      <div className="card">
        {fs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No lasting change detected.</p>
        ) : (
          <div className="table-scroll"><table>
            <thead>
              <tr><th>Flag</th><th>Where</th><th>Category</th><th className="num">Area</th><th>First seen</th><th>Persistence</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {fs.map((f) => (
                <tr key={f.flag_id} className={`clickable${zoomTo === f.flag_id ? " active" : ""}`} tabIndex={0}
                  title="Show this flag on the map"
                  onClick={() => zoom(f.flag_id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), zoom(f.flag_id))}
                  onMouseEnter={() => setFocusFlag(f.flag_id)} onMouseLeave={() => setFocusFlag(zoomTo)}>
                  <td>{f.flag_id.split("-").at(-1)}</td>
                  <td>{f.zone === "lakebed" ? "Lake bed" : "30 m buffer"}</td>
                  <td>{kindLabel(f.kind)}</td>
                  <td className="num">{ac(f.area_ac)}</td>
                  <td>{seasonLabel(f.first_seen)}</td>
                  <td>{f.status === "confirmed" ? "Confirmed (2+ seasons)" : "New (1 season)"}</td>
                  <td><span className={`pill ${f.confidence}`}>{f.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>Select a flag to see it on the map. Change detected, not proof of encroachment.</p>
      </div>

      <h2>Lake cover each dry season</h2>
      <div className="card">
        <AreaChart seasons={dry} selected={season} />
      </div>

      <details className="method">
        <summary>Methodology and limitations for this lake</summary>
        <dl>
          <dt>Imagery</dt><dd>Sentinel-2 Level-2A (10 m), {dry.reduce((a, s) => a + s.scene_ids.length, 0)} dry-season scenes from 2019 to 2026, via Earth Search on AWS Open Data.</dd>
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
            <h2 style={{ marginTop: 0 }}>Act on it</h2>
            <p className="small" style={{ color: "var(--body)" }}>
              The evidence pack has dated images, areas, coordinates, satellite scene IDs and the method, plus draft
              complaint and RTI letters.
            </p>
            <Link className="button" href={`/lake/${id}/evidence/`}>Open the evidence pack</Link>
          </div>
          <WatchForm lake={id} name={stats.name} />
        </div>
      </section>
    </main>
  );
}
