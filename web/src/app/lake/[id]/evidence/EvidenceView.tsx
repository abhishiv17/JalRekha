"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark, Wordmark } from "@/components/Brand";
import { JalIcon, Loader } from "@/components/Mascot";
import OutlinedImage from "@/components/OutlinedImage";
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

type Flag = FeatureCollection<FlagProps>["features"][number];
const DISCLAIMER = "Satellite-detected change is not proof of illegal encroachment. Verify on the ground and in official records.";

function centroid(g: GeoJSON.Geometry): [number, number] {
  const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.type === "MultiPolygon" ? g.coordinates.map((p) => p[0]) : [];
  const pts = rings.flat();
  if (!pts.length) return [0, 0];
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

function toKml(lake: string, flags: Flag[]): string {
  const polys = (g: GeoJSON.Geometry) =>
    (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [])
      .map((p) => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${p[0].map(([x, y]) => `${x},${y},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>`)
      .join("");
  const marks = flags.map(({ properties: p, geometry }) => {
    const data = [["zone", p.zone], ["category", kindLabel(p.kind)], ["area_ac", p.area_ac.toFixed(2)], ["first_seen", p.first_seen], ["persistence", p.status], ["confidence", p.confidence]]
      .map(([k, v]) => `<Data name="${k}"><value>${esc(String(v))}</value></Data>`).join("");
    return `<Placemark><name>${esc(p.flag_id)}</name><description>${esc(`${kindLabel(p.kind)}, ${p.area_ac.toFixed(2)} ac, first seen ${seasonLabel(p.first_seen)}`)}</description><styleUrl>#flag</styleUrl><ExtendedData>${data}</ExtendedData><MultiGeometry>${polys(geometry)}</MultiGeometry></Placemark>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(`JalRekha change flags: ${lake}`)}</name><description>${esc(DISCLAIMER)}</description><Style id="flag"><LineStyle><color>ff24a5f5</color><width>3</width></LineStyle><PolyStyle><color>4024a5f5</color></PolyStyle></Style>${marks}</Document></kml>`;
}

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m);
}

function Letter({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{title}</strong>
        <button className="secondary no-print" onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy text"}
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.9rem" }}>{text}</pre>
    </div>
  );
}

export default function EvidenceView({ id }: { id: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [geo, setGeo] = useState<{
    bounds: [number, number, number, number];
    reference: FeatureCollection<{ kind: "reference" | "buffer"; width_m?: number }>;
  } | null>(null);
  const [templates, setTemplates] = useState<{ complaint: string; rti: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    Promise.all([
      loadStats(id),
      loadFlags(id),
      fetch("/templates/complaint.md").then((r) => { if (!r.ok) throw new Error("complaint template"); return r.text(); }),
      fetch("/templates/rti.md").then((r) => { if (!r.ok) throw new Error("RTI template"); return r.text(); }),
      loadBounds(id),
      loadReference(id),
    ])
      .then(([s, f, complaint, rti, b, reference]) => {
        setStats(s);
        setFlags(f.features);
        setTemplates({ complaint, rti });
        setGeo({ bounds: b.bounds, reference });
        // The browser offers the page title as the PDF file name.
        document.title = `JalRekha evidence pack - ${s.name} - ${new Date().toISOString().slice(0, 10)}`;
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 6000);
    return () => clearTimeout(t);
  }, [saved]);

  if (error) {
    return (
      <main>
        <p className="notice error">The evidence pack could not be built: {error}. Nothing was generated.</p>
        <Link href={`/lake/${id}/`}>Back to the lake</Link>
      </main>
    );
  }
  if (!stats || !templates || !geo) return <main><Loader label="Building evidence pack…" /></main>;

  const place = ANALYSED_META[id];
  const usable = drySeasons(stats).filter((s) => s.status === "ok");
  const first = usable[0];
  const last = usable.at(-1);
  const top = [...flags].sort((a, b) => b.properties.area_ac - a.properties.area_ac)[0];
  const date = generatedAt.toISOString().slice(0, 10);
  const packId = `${id}-${date}`;
  const scenes = Array.from(new Set(stats.seasons.flatMap((s) => s.scene_ids))).sort();
  const outlineCredit = place?.osmId
    ? "Lake outline © OpenStreetMap contributors (ODbL)."
    : "Lake outline: ATREE-CSEI, Map of Lakes in Bengaluru Urban (CC BY).";
  const byKind = Object.keys(KIND_LABELS)
    .map((k) => ({ label: KIND_LABELS[k], area: flags.filter((f) => (f.properties.kind ?? "fill_or_construction") === k).reduce((a, f) => a + f.properties.area_ac, 0) }))
    .filter((x) => x.area > 0);

  const letterValues = (f: Flag | undefined): Record<string, string> => {
    const [lon, lat] = f ? centroid(f.geometry) : [0, 0];
    return {
      lake_name: stats.name,
      flag_id: f?.properties.flag_id ?? "",
      centroid_lat: lat.toFixed(5),
      centroid_lon: lon.toFixed(5),
      area_ac: f ? f.properties.area_ac.toFixed(2) : "",
      zone: f?.properties.zone === "buffer" ? "30 m buffer" : "lakebed",
      first_seen: f ? seasonLabel(f.properties.first_seen) : "",
      status: f?.properties.status ?? "",
      confidence: f?.properties.confidence ?? "",
      scene_ids: f?.properties.scene_ids.join(", ") ?? "",
      baseline_years: "2019–2020",
      pack_id: packId,
    };
  };

  const geojson = () => {
    download(`jalrekha-${id}-flags.geojson`, "application/geo+json", JSON.stringify({
      type: "FeatureCollection",
      name: `JalRekha change flags: ${stats.name}`,
      disclaimer: DISCLAIMER,
      results_as_of: stats.as_of,
      features: flags,
    }, null, 2));
    setSaved("GeoJSON");
  };
  const kml = () => {
    download(`jalrekha-${id}-flags.kml`, "application/vnd.google-earth.kml+xml", toKml(stats.name, flags));
    setSaved("KML");
  };
  const sceneList = () => {
    const rows = stats.seasons.flatMap((s) => s.scene_ids.map((sid) => `${s.season},${sid}`));
    download(`jalrekha-${id}-scenes.csv`, "text/csv", ["season,scene_id", ...rows].join("\n"));
    setSaved("scene list");
  };

  return (
    <main>
      <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <Link href={`/lake/${id}/`}>← Back to {stats.name}</Link>
        <div className="row">
          <button className="secondary" onClick={geojson} disabled={!flags.length}>Download GeoJSON</button>
          <button className="secondary" onClick={kml} disabled={!flags.length}>Download KML</button>
          <button onClick={() => window.print()}>Save as PDF (print)</button>
        </div>
      </div>

      <header className="report-head">
        <span className="brand"><BrandMark size={32} /><Wordmark sub={false} /></span>
        <span className="small muted" style={{ textAlign: "right" }}>
          Evidence pack {packId}<br />Generated {generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · results as of {stats.as_of}
        </span>
      </header>

      <h1 style={{ fontSize: "clamp(34px, 4.6vw, 54px)", marginTop: 20 }}>{stats.name}</h1>
      <p className="lede">{place ? placeLabel(place) : ""}</p>
      {stats.sample && <p className="notice error">Sample data, not real results. Do not file.</p>}
      <p className="disclaimer" style={{ marginTop: 16 }}>{DISCLAIMER}</p>

      <h2>Summary</h2>
      <table>
        <tbody>
          <tr><th>Observation period</th><td>Sentinel-2 dry seasons (January–April) 2019–2026; {usable.length} of {drySeasons(stats).length} with clear imagery</td></tr>
          <tr><th>Baseline</th><td>Dry seasons 2019 and 2020</td></tr>
          <tr><th>Compared through</th><td>{last ? seasonLabel(last.season) : "—"}</td></tr>
          <tr><th>Reference lake area</th><td>{stats.reference_area_ac.toFixed(2)} acres (mapped outline plus water present in both baseline seasons)</td></tr>
          <tr><th>Area flagged as changed</th><td>{stats.flags_total_ac.toFixed(2)} acres in {flags.length} flag{flags.length === 1 ? "" : "s"}{byKind.length ? `: ${byKind.map((x) => `${x.area.toFixed(2)} ac ${x.label.toLowerCase()}`).join(", ")}` : ""}</td></tr>
          <tr><th>Inside the 30 m buffer (KTCDA Act, 2014)</th><td>{(stats.buffer.change_in_buffer_ac["30"] ?? 0).toFixed(2)} acres</td></tr>
        </tbody>
      </table>

      {first && last && first.season !== last.season && (
        <>
          <h2>Before and after</h2>
          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {[first, last].map((s) => (
              <figure key={s.season} style={{ margin: 0 }}>
                <OutlinedImage src={lakeUrl(id, `truecolor/${s.season}.png`)} alt={`${stats.name}, ${seasonLabel(s.season)}`}
                  bounds={geo.bounds} reference={geo.reference}
                  flags={s === last ? { type: "FeatureCollection", features: flags } : undefined} />
                <figcaption className="small" style={{ marginTop: 6 }}>{seasonLabel(s.season)} · Sentinel-2 median of {s.clear_looks} clear looks</figcaption>
              </figure>
            ))}
          </div>
          <div className="legend">
            <span><i style={{ border: "2px solid #fff", background: "#8a958f" }} />Lake outline</span>
            <span><i style={{ border: "2px solid var(--flag)", background: "rgba(245,165,36,.25)" }} />Change flag (after image only)</span>
          </div>
        </>
      )}

      <h2>Change flags</h2>
      <div className="table-scroll"><table>
        <thead>
          <tr><th>Flag</th><th>Zone</th><th>Category</th><th className="num">Acres</th><th>First seen</th><th>Persistence</th><th>Confidence</th><th>Centre (lat, lon)</th></tr>
        </thead>
        <tbody>
          {flags.map((f) => {
            const [lon, lat] = centroid(f.geometry);
            const p = f.properties;
            return (
              <tr key={p.flag_id}>
                <td>{p.flag_id}</td>
                <td>{p.zone === "buffer" ? "30 m buffer" : "Lake bed"}</td>
                <td>{kindLabel(p.kind)}</td>
                <td className="num">{p.area_ac.toFixed(2)}</td>
                <td>{seasonLabel(p.first_seen)}</td>
                <td>{p.status === "confirmed" ? "Confirmed (2+ seasons)" : "New (1 season)"}</td>
                <td>{p.confidence}</td>
                <td>{lat.toFixed(5)}, {lon.toFixed(5)}</td>
              </tr>
            );
          })}
          {flags.length === 0 && <tr><td colSpan={8}>No lasting change detected.</td></tr>}
        </tbody>
      </table></div>

      <h2>Lake cover by dry season (acres)</h2>
      <div className="table-scroll"><table>
        <thead>
          <tr><th>Season</th><th className="num">Open water</th><th className="num">Floating veg.</th><th className="num">Bare/built</th><th className="num">Grassed bed</th><th className="num">Clear looks</th></tr>
        </thead>
        <tbody>
          {drySeasons(stats).map((s) => (
            <tr key={s.season}>
              <td>{seasonLabel(s.season)}</td>
              {s.status === "ok" ? (
                <>
                  <td className="num">{s.water_ac?.toFixed(2)}</td>
                  <td className="num">{s.floating_veg_ac?.toFixed(2)}</td>
                  <td className="num">{s.bare_built_ac?.toFixed(2)}</td>
                  <td className="num">{s.land_veg_ac?.toFixed(2) ?? "—"}</td>
                </>
              ) : (
                <td colSpan={4} className="muted">Not enough clear images</td>
              )}
              <td className="num">{s.clear_looks}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <h2>Method</h2>
      <p className="small" style={{ color: "var(--body)" }}>
        Sentinel-2 Level-2A imagery (10 m) from the Registry of Open Data on AWS, found through Earth Search. Clouds,
        cloud shadows and building shadows removed. For each year, a median composite of January–April. Each pixel is
        classed as water (MNDWI above a per-lake threshold), floating vegetation (NDVI ≥ {stats.thresholds.veg_ndvi} with low
        shortwave-infrared reflectance, counted as lake), land vegetation, or bare/built (NDVI &lt; {stats.thresholds.bare_ndvi}
        and NDBI &gt; {stats.thresholds.ndbi}). A lake-bed pixel is flagged only if it was lake in every 2019–2020 dry season
        and is land in its latest dry seasons; two seasons in a row is &ldquo;confirmed&rdquo;. In the 30 m buffer, only
        natural ground that turned bare or built is flagged. Patches under {stats.thresholds.min_flag_px} pixels
        ({stats.thresholds.min_flag_px * 100} m²) are dropped.
      </p>
      <p className="small" style={{ color: "var(--body)" }}>
        <strong>Reproducible:</strong> {scenes.length} Sentinel-2 scenes were used. Anyone can re-run the analysis from
        their IDs with the open-source code.{" "}
        <button type="button" className="ghost no-print" onClick={sceneList}>Download scene list (CSV)</button>
      </p>
      <details className="scenes no-print">
        <summary className="small">Show all scene IDs</summary>
        <ul className="scene-ids">{scenes.map((sid) => <li key={sid}>{sid}</li>)}</ul>
      </details>

      <h2>Limitations</h2>
      <ul className="small" style={{ color: "var(--body)", paddingLeft: 18 }}>
        <li>Not a land survey: change is measured against the lake&apos;s historical water extent, not the revenue boundary.</li>
        <li>10 m pixels: small structures and walls can be missed; areas are approximate.</li>
        <li>Legal works (desilting, walkways, treatment plants) also appear as change.</li>
        <li>Losses before 2019 are outside this record.</li>
      </ul>

      <h2>Draft letters</h2>
      <p className="small muted no-print">Filled from the largest flag. Complete the parts in [square brackets] before sending.</p>
      <Letter title="Complaint to the lake custodian" text={fill(templates.complaint, letterValues(top))} />
      <Letter title="RTI application" text={fill(templates.rti, letterValues(top))} />

      <p className="small muted" style={{ marginTop: 24 }}>
        Credits: contains modified Copernicus Sentinel data (2019–2026). {outlineCredit} Generated by JalRekha.
      </p>

      {saved && (
        <div className="toast no-print" role="status">
          <JalIcon size={40} />
          <span>Downloaded the {saved} for {stats.name}.</span>
        </div>
      )}
    </main>
  );
}
