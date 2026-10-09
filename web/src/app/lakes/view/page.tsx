"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import LakeShape from "@/components/LakeShape";
import { EmptyState, Guide, Loader } from "@/components/Mascot";
import { type Card, cards, loadCatalog, placeLabel } from "@/lib/catalog";
import { loadIndex } from "@/lib/data";

const IndiaMap = dynamic(() => import("@/components/IndiaMap"), { ssr: false });

const km = (a: Card, b: Card) =>
  Math.hypot((a.lat! - b.lat!) * 111, (a.lon! - b.lon!) * 111 * Math.cos((a.lat! * Math.PI) / 180));

function osmLink(id: string) {
  const m = /^osm-([wr])(\d+)$/.exec(id);
  return m ? `https://www.openstreetmap.org/${m[1] === "w" ? "way" : "relation"}/${m[2]}` : null;
}

// The id lives in ?id=, read on the client (static export).
export default function QueuedLakePage() {
  return (
    <Suspense fallback={<main><Loader label="Finding this lake on the map…" /></main>}>
      <QueuedLake />
    </Suspense>
  );
}

/** A catalog lake that hasn't been analysed yet. */
function QueuedLake() {
  const router = useRouter();
  // Read from the URL on every navigation, so links to other lakes on this page work.
  const id = useSearchParams().get("id");
  const [all, setAll] = useState<Card[] | null>(null);

  useEffect(() => {
    Promise.all([loadIndex().then((i) => i.lakes).catch(() => []), loadCatalog()]).then(([idx, osm]) =>
      setAll(cards(idx, osm)),
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const lake = useMemo(() => all?.find((c) => c.id === id), [all, id]);
  useEffect(() => {
    if (lake?.analysed) router.replace(`/lake/${lake.id}/`);
  }, [lake, router]);
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

  if (!all) return <main><Loader label="Finding this lake on the map…" /></main>;
  if (!lake) {
    return (
      <main>
        <EmptyState title="Lake not found">
          <p>This lake isn&apos;t in the catalogue. <Link href="/lakes/">Browse all lakes</Link>.</p>
        </EmptyState>
      </main>
    );
  }
  if (lake.analysed) return <main><Loader label={`Opening ${lake.name}…`} /></main>;

  const osm = osmLink(lake.id);
  return (
    <main key={lake.id}>
      <Link href="/lakes/" className="small muted" style={{ textDecoration: "none" }}>← All lakes</Link>
      <div className="row" style={{ alignItems: "flex-end", gap: 16, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <h1>{lake.name}</h1>
          <p className="lede" style={{ marginBottom: 6 }}>{placeLabel(lake)}</p>
        </div>
        <span className="pill" style={{ marginBottom: 12 }}>Not tracked yet</span>
      </div>

      {lake.lat != null && (
        <div className="card check-cta">
          <div>
            <strong>Buying or renting near {lake.name}?</strong>
            <div className="small muted">Check if a plot here was ever lake water or floods. Takes about 2 minutes.</div>
          </div>
          <Link className="button" href={`/check/?lat=${lake.lat}&lon=${lake.lon}`}>Check a plot near this lake</Link>
        </div>
      )}

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
              <img src={lake.thumb} crossOrigin="anonymous" alt={`Satellite view of ${lake.name}, 2026 dry season`} />
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
            <h2 style={{ marginTop: 0 }}>We don&rsquo;t track this lake yet</h2>
            <Guide size={56}>
              {`I know where ${lake.name} is, but I haven't tracked how it changed over the years. ${
                nearby.analysed[0]
                  ? `The closest lake I track is ${nearby.analysed[0].name}, ${Math.round(km(lake, nearby.analysed[0]))} km away.`
                  : "No lake near it is tracked yet either."
              } You can still check any plot near it.`}
            </Guide>
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
