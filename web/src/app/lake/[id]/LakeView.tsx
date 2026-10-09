"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AreaChart from "@/components/AreaChart";
import Swipe from "@/components/Swipe";
import WatchForm from "@/components/WatchForm";
import { ANALYSED_META, placeLabel } from "@/lib/catalog";
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

export default function LakeView({ id }: { id: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [bufferWidth, setBufferWidth] = useState(30);
  const [focusFlag, setFocusFlag] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadStats(id), loadFlags(id), loadReference(id), loadBounds(id)])
      .then(([stats, flags, reference, b]) => {
        setData({ stats, flags, reference, bounds: b.bounds });
        setSeasonIdx(drySeasons(stats).length - 1);
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  const dry = useMemo(() => (data ? drySeasons(data.stats) : []), [data]);
  const usable = dry.filter((s) => s.status === "ok");

  if (error) return <main><p>Could not load this lake: {error}</p></main>;
  if (!data) return <main><p className="muted">Loading…</p></main>;

  const { stats, flags, reference, bounds } = data;
  const place = ANALYSED_META[id];
  const season = dry[seasonIdx] ?? dry.at(-1)!;
  const bill = stats.buffer.bill_2025_m;
  const inBuffer = stats.buffer.change_in_buffer_ac[String(bufferWidth)] ?? 0;
  const first = usable[0]?.season;
  const last = usable.at(-1)?.season;

  return (
    <main>
      <Link href="/lakes/" className="small muted" style={{ textDecoration: "none" }}>← All lakes</Link>
      <h1>{stats.name}</h1>
      {place && <p className="lede" style={{ marginBottom: 6 }}>{placeLabel(place)}</p>}
      <p className="muted">
        Reference area {stats.reference_area_ac.toFixed(1)} acres · {stats.flags_total_ac.toFixed(2)} acres flagged
        as changed · as of {stats.as_of}
      </p>
      {stats.sample && <p className="notice">Sample data, not real results.</p>}
      {place?.note && <p className="notice"><strong>Read before using these flags:</strong> {place.note}</p>}

      <div className="grid2">
        <section>
          <LakeMap
            bounds={bounds}
            imageUrl={lakeUrl(id, `truecolor/${season.season}.png`)}
            overlayUrl={lakeUrl(id, `overlay/${season.season}.png`)}
            showOverlay={showOverlay}
            flags={flags}
            reference={reference}
            bufferWidth={bufferWidth}
            focusFlag={focusFlag}
          />
          <div className="card" style={{ marginTop: 12 }}>
            <label htmlFor="year"><strong>{seasonLabel(season.season)}</strong>
              {season.status !== "ok" && <span className="muted"> · not enough clear images</span>}
            </label>
            <input
              id="year"
              className="slider"
              type="range"
              min={0}
              max={dry.length - 1}
              value={seasonIdx}
              onChange={(e) => setSeasonIdx(Number(e.target.value))}
            />
            <div className="row small muted" style={{ justifyContent: "space-between" }}>
              <span>{dry[0]?.season.slice(0, 4)}</span>
              <span>{dry.at(-1)?.season.slice(0, 4)}</span>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="small">
                <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />{" "}
                Show what covers the lake
              </label>
            </div>
            <div className="legend">
              <span><i style={{ background: "var(--water)" }} />Open water</span>
              <span><i style={{ background: "var(--veg)" }} />Floating vegetation (still lake)</span>
              <span><i style={{ background: "var(--bare)" }} />Bare or built</span>
              <span><i style={{ border: "2px solid #ff3b1f" }} />Change flag</span>
              <span><i style={{ border: "2px dashed #f2c200" }} />Buffer</span>
            </div>
          </div>
        </section>

        <section>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Protected buffer</h2>
            <div className="row">
              <button className={bufferWidth === 30 ? "" : "secondary"} onClick={() => setBufferWidth(30)}>
                30 m · current law
              </button>
              {bill !== 30 && bill > 0 && (
                <button className={bufferWidth === bill ? "" : "secondary"} onClick={() => setBufferWidth(bill)}>
                  {bill} m · 2025 bill
                </button>
              )}
            </div>
            <p>
              <span className="stat">{inBuffer.toFixed(2)} ac</span>{" "}
              <span className="muted">of flagged change inside the {bufferWidth} m buffer</span>
            </p>
            <p className="small muted">
              The KTCDA Act (2014) protects 30 m around every lake. A 2025 amendment that would set {bill} m for a lake
              this size was returned by the Governor and is not in force (as of {stats.as_of}).
            </p>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Act on it</h2>
            <p className="small">
              A file you can attach to a complaint or RTI: images, areas, coordinates, satellite scene IDs and method.
            </p>
            <Link className="button" href={`/lake/${id}/evidence/`}>Open evidence pack</Link>
            <WatchForm lake={id} />
          </div>
        </section>
      </div>

      <h2>Area each dry season</h2>
      <div className="card">
        <AreaChart seasons={dry} selected={season.season} />
        <p className="small muted">
          January–April each year, so a dry summer isn&apos;t mistaken for loss. Vegetation floating on the water
          (hyacinth, algae) is counted as lake, never as loss; it reflects little shortwave infrared because water lies
          beneath it, unlike grass on land.
        </p>
      </div>

      <h2>Change flags</h2>
      <div className="card">
        {flags.features.length === 0 ? (
          <p className="muted">No lasting change detected.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Flag</th><th>Where</th><th>Now</th><th className="num">Area</th><th>First seen</th><th>Status</th><th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {flags.features.map(({ properties: f }) => (
                <tr key={f.flag_id} onMouseEnter={() => setFocusFlag(f.flag_id)} onMouseLeave={() => setFocusFlag(null)}>
                  <td>{f.flag_id.split("-").at(-1)}</td>
                  <td>{f.zone === "lakebed" ? "Lake bed" : "Buffer"}</td>
                  <td>{kindLabel(f.kind)}</td>
                  <td className="num">{f.area_ac.toFixed(2)} ac</td>
                  <td>{seasonLabel(f.first_seen)}</td>
                  <td>{f.status === "confirmed" ? "Confirmed (2+ seasons)" : "New (1 season)"}</td>
                  <td><span className={`pill ${f.confidence}`}>{f.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">Change detected, not proof of encroachment. Verify on the ground and in records.</p>
      </div>

      {first && last && first !== last && (
        <>
          <h2>Before and after</h2>
          <div className="card">
            <Swipe
              before={lakeUrl(id, `truecolor/${first}.png`)}
              after={lakeUrl(id, `truecolor/${last}.png`)}
              beforeLabel={seasonLabel(first)}
              afterLabel={seasonLabel(last)}
            />
          </div>
        </>
      )}
    </main>
  );
}
