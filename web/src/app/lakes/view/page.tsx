"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import LakeShape from "@/components/LakeShape";
import Jal, { EmptyState, Loader } from "@/components/Mascot";
import { type Card, cards, loadCatalog, placeLabel } from "@/lib/catalog";
import { loadIndex } from "@/lib/data";

const IndiaMap = dynamic(() => import("@/components/IndiaMap"), { ssr: false });

const km = (a: Card, b: Card) =>
  Math.hypot((a.lat! - b.lat!) * 111, (a.lon! - b.lon!) * 111 * Math.cos((a.lat! * Math.PI) / 180));

function osmLink(id: string) {
  const m = /^osm-([wr])(\d+)$/.exec(id);
  return m ? `https://www.openstreetmap.org/${m[1] === "w" ? "way" : "relation"}/${m[2]}` : null;
}

/** A catalog lake that hasn't been analysed yet. */
export default function QueuedLake() {
  const [all, setAll] = useState<Card[] | null>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
    Promise.all([loadIndex().then((i) => i.lakes).catch(() => []), loadCatalog()]).then(([idx, osm]) =>
      setAll(cards(idx, osm)),
    );
  }, []);

  const lake = useMemo(() => all?.find((c) => c.id === id), [all, id]);
  const nearby = useMemo(() => {
    if (!all || !lake || lake.lat == null) return { analysed: [] as Card[], queued: [] as Card[] };
    const withDist = all
      .filter((c) => c.id !== lake.id && c.lat != null)
      .map((c) => ({ c, d: km(lake, c) }))
      .sort((a, b) => a.d - b.d);
    return {
      analysed: withDist.filter((x) => x.c.analysed).slice(0, 3).map((x) => x.c),
      queued: withDist.filter((x) => !x.c.analysed && x.d < 40).slice(0, 6).map((x) => x.c),
    };
  }, [all, lake]);

  if (!all) return <main><Loader label="Loading lake…" /></main>;
  if (!lake) {
    return (
      <main>
        <EmptyState title="Lake not found">
          <p>This lake isn&apos;t in the catalogue. <Link href="/lakes/">Browse all lakes</Link>.</p>
        </EmptyState>
      </main>
    );
  }
  if (lake.analysed) {
    window.location.replace(`/lake/${lake.id}/`);
    return null;
  }

  const osm = osmLink(lake.id);
  return (
    <main>
      <Link href="/lakes/" className="small muted" style={{ textDecoration: "none" }}>← All lakes</Link>
      <div className="row" style={{ alignItems: "flex-end", gap: 16, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <h1>{lake.name}</h1>
          <p className="lede" style={{ marginBottom: 6 }}>{placeLabel(lake)}</p>
        </div>
        <span className="pill" style={{ marginBottom: 12 }}>Queued for analysis</span>
      </div>

      <dl className="stat-tiles">
        <div className="stat-tile"><dt>LAKE</dt>
          <dd>{lake.areaAc != null ? `${Math.round(lake.areaAc).toLocaleString("en-IN")} ac` : "—"}<small>mapped on OpenStreetMap</small></dd></div>
        <div className="stat-tile"><dt>STATE</dt><dd style={{ fontSize: 22 }}>{lake.state}<small>{lake.city ? `near ${lake.city}` : " "}</small></dd></div>
        <div className="stat-tile"><dt>CENTRE</dt>
          <dd style={{ fontSize: 20 }}>{lake.lat?.toFixed(4)}, {lake.lon?.toFixed(4)}<small>latitude, longitude</small></dd></div>
        <div className="stat-tile"><dt>CHANGE</dt><dd>—<small>no results until analysed</small></dd></div>
      </dl>

      <div className="grid2">
        <section>
          <div className="lake-thumb" style={{ aspectRatio: "4 / 3" }}>
            {lake.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lake.thumb} alt={`Satellite view of ${lake.name}, 2026 dry season`} />
            ) : lake.shapeState ? (
              <LakeShape id={lake.id} state={lake.shapeState} label={lake.name} />
            ) : null}
            <span className="label">{lake.thumb ? "SENTINEL-2 · DRY SEASON 2026" : "OUTLINE · OPENSTREETMAP"}</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <IndiaMap lakes={[lake, ...nearby.queued]} />
          </div>
        </section>

        <section>
          <div className="card">
            <div className="row" style={{ gap: 14, alignItems: "center" }}>
              <Jal size={72} />
              <h2 style={{ margin: 0 }}>This lake has not been analysed yet</h2>
            </div>
            <p className="small" style={{ color: "var(--body)" }}>
              JalRekha has this lake&apos;s outline but hasn&apos;t run the satellite analysis, so there are no change
              numbers yet. Getting results takes three steps:
            </p>
            <ol className="small" style={{ paddingLeft: 18, color: "var(--body)", lineHeight: 1.6 }}>
              <li>Check the outline against the lake as it was in 2019.</li>
              <li>Run the same pipeline as every analysed lake: eight dry seasons of Sentinel-2 on AWS, about two minutes.</li>
              <li>Hand-check every flag before it is shown.</li>
            </ol>
            <div className="row" style={{ gap: 10, marginTop: 8 }}>
              {osm && <a className="button secondary" href={osm} target="_blank" rel="noopener noreferrer">View on OpenStreetMap</a>}
              {lake.lat != null && (
                <a className="button secondary" target="_blank" rel="noopener noreferrer"
                  href={`https://www.google.com/maps/@${lake.lat},${lake.lon},16z/data=!3m1!1e3`}>Satellite view</a>
              )}
            </div>
          </div>
          {nearby.analysed.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h2 style={{ marginTop: 0 }}>Closest analysed lakes</h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {nearby.analysed.map((c) => (
                  <li key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                    <Link href={`/lake/${c.id}/`}><strong>{c.name}</strong></Link>
                    <span className="small muted"> · {placeLabel(c)} · {Math.round(km(lake, c))} km away</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {nearby.queued.length > 0 && (
        <>
          <h2>Other lakes nearby</h2>
          <div className="lake-grid">{nearby.queued.map((c) => <LakeCard key={c.id} c={c} facts={false} />)}</div>
        </>
      )}

      <p className="small muted" style={{ marginTop: 48 }}>
        Outline and name © OpenStreetMap contributors (ODbL).
      </p>
    </main>
  );
}
