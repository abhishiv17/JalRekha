"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import EvidenceView from "@/app/lake/[id]/evidence/EvidenceView";
import LakeView from "@/app/lake/[id]/LakeView";
import CheckProgress, { type ProgressStep } from "@/components/CheckProgress";
import LakeCard from "@/components/LakeCard";
import LakeShape from "@/components/LakeShape";
import { EmptyState, Guide, Loader } from "@/components/Mascot";
import { ANALYSED_META, type Card, type OsmLake, cardHref, cards, loadCatalog, placeLabel } from "@/lib/catalog";
import { DATA_URL, loadIndex } from "@/lib/data";
import { PLOT_API_URL, type TrackStatus, getTrack, trackLake } from "@/lib/plot";

const MAX_HA = 1000; // same as pipeline/jalrekha/track.py
const POLL_MS = 2500;

const TRACK_STEPS: ProgressStep[] = [
  { id: "queued", label: "Starting", faces: [
    { mood: "happy", say: "Getting ready to watch this lake…" },
    { mood: "wink", say: "Waking up the satellites…" },
  ] },
  { id: "outline", label: "Finding the lake's edge", faces: [
    { mood: "searching", say: "Finding the lake's edge on the map…" },
    { mood: "curious", say: "Where does the water stop?" },
  ] },
  { id: "read", label: "Reading satellite photos, 2019 to 2026", faces: [
    { mood: "scanning", say: "Looking down at the lake from space…" },
    { mood: "searching", say: "Checking every clear photo…" },
    { mood: "surprised", say: "So many photos of one lake!" },
  ] },
  { id: "change", label: "Looking for lake that became land", faces: [
    { mood: "thinking", say: "Comparing every year with 2019…" },
    { mood: "cautious", say: "Did any of it turn into land?" },
  ] },
  { id: "save", label: "Saving the results", faces: [
    { mood: "writing", say: "Writing it all down…" },
    { mood: "wink", say: "Almost done!" },
  ] },
];

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
  const params = useSearchParams();
  const id = params.get("id");
  const view = params.get("view");
  const [track, setTrack] = useState<TrackStatus | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [all, setAll] = useState<Card[] | null>(null);
  const [osmAll, setOsmAll] = useState<OsmLake[]>([]);

  useEffect(() => {
    Promise.all([loadIndex().then((i) => i.lakes).catch(() => []), loadCatalog()]).then(([idx, osm]) => {
      setOsmAll(osm);
      setAll(cards(idx, osm));
    },
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // A lake we track is listed under our own id, not its OpenStreetMap id. Links that
  // carry the OpenStreetMap id (Plot Check's "See this lake") land on the tracked lake.
  const lake = useMemo(() => {
    if (!all) return undefined;
    const direct = all.find((c) => c.id === id);
    if (direct) return direct;
    const tracked = Object.entries(ANALYSED_META).find(([, m]) => m.osmId === id)?.[0];
    if (tracked) return all.find((c) => c.id === tracked);
    const o = osmAll.find((x) => x.id === id);
    if (!o) return undefined;
    // Hidden from the catalogue because a tracked lake sits on it: open that one.
    return all
      .filter((c) => c.analysed && c.lat != null)
      .map((c) => ({ c, d: Math.hypot((c.lat! - o.lat) * 111, (c.lon! - o.lon) * 111 * Math.cos((o.lat * Math.PI) / 180)) }))
      .filter((x) => x.d <= 1)
      .sort((a, b) => a.d - b.d)[0]?.c;
  }, [all, osmAll, id]);
  useEffect(() => {
    if (lake?.analysed && !lake.id.startsWith("osm-")) router.replace(`/lake/${lake.id}/`);
  }, [lake, router]);

  // Follow a tracking run (started here or by someone else) until it finishes.
  const tracking = track?.status === "queued" || track?.status === "running";
  useEffect(() => {
    if (!lake || lake.analysed || !PLOT_API_URL || !lake.id.startsWith("osm-")) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const t = await getTrack(lake.id);
        if (stop) return;
        if (t.status === "done") {
          // Fresh lake list first (the API caches it for a few minutes; skip the cache):
          // setting the status ends this effect, which would drop a later update.
          const idx = await fetch(`${DATA_URL}/index.json?t=${Date.now()}`).then((r) => r.json());
          if (stop) return;
          setAll(cards(idx.lakes, osmAll));
        }
        setTrack(t);
        if (t.status === "queued" || t.status === "running") timer = setTimeout(tick, POLL_MS);
      } catch {
        /* status is a nicety; the button still works */
      }
    };
    if (track === null || tracking) tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lake?.id, lake?.analysed, tracking]);

  async function startTrack() {
    if (!lake) return;
    setTrackError(null);
    try {
      setTrack(await trackLake(lake.id));
    } catch (e) {
      setTrackError(`Could not start: ${e instanceof Error ? e.message : "network error"}.`);
    }
  }
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
  if (lake.analysed) {
    if (!lake.id.startsWith("osm-")) return <main><Loader label={`Opening ${lake.name}…`} /></main>;
    const place = { city: lake.city, state: lake.state };
    return view === "proof" ? <EvidenceView id={lake.id} place={place} /> : <LakeView id={lake.id} place={place} />;
  }
  const tooBig = (lake.areaAc ?? 0) * 0.404686 > MAX_HA;

  const osm = osmLink(lake.id);
  return (
    <main key={lake.id}>
      <Link href="/lakes/" className="small muted" style={{ textDecoration: "none" }}>← All lakes</Link>
      <div className="row" style={{ alignItems: "flex-end", gap: 16, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <h1>{lake.name}</h1>
          <p className="lede" style={{ marginBottom: 6 }}>{placeLabel(lake)}</p>
        </div>
        <span className="pill" style={{ marginBottom: 12 }}>{tracking ? "Tracking now…" : "Not tracked yet"}</span>
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
          <dd>{lake.areaAc != null ? `${Math.round(lake.areaAc).toLocaleString("en-IN")} acres` : "—"}<small>size on OpenStreetMap</small></dd></div>
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
          {tracking ? (
            <CheckProgress progress={track?.progress} since={track?.created} steps={TRACK_STEPS} usually="usually 2 to 4 minutes" />
          ) : (
          <div className="card track-card">
            <h2 style={{ marginTop: 0 }}>Track this lake</h2>
            <Guide size={56}>
              {tooBig
                ? `${lake.name} is very big, so I can't track it in one go yet. You can still check any plot near it.`
                : `I know where ${lake.name} is. Press the button and I'll look at every satellite photo of it since 2019 and show how it changed. It takes about 2 to 4 minutes.`}
            </Guide>
            {!tooBig && PLOT_API_URL && (
              <button type="button" className="button big track-button" onClick={startTrack}>
                Track this lake
              </button>
            )}
            {track?.status === "error" && <p className="notice error">Tracking didn&rsquo;t finish: {track.error}. Press the button to try again.</p>}
            {trackError && <p className="notice error">{trackError}</p>}
            <div className="row" style={{ gap: 10, marginTop: 8 }}>
              {osm && <a className="button secondary" href={osm} target="_blank" rel="noopener noreferrer">View on OpenStreetMap</a>}
              {lake.lat != null && (
                <a className="button secondary" target="_blank" rel="noopener noreferrer"
                  href={`https://www.google.com/maps/@${lake.lat},${lake.lon},16z/data=!3m1!1e3`}>Satellite view</a>
              )}
            </div>
          </div>
          )}
          {nearby.analysed.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h2 style={{ marginTop: 0 }}>Closest analysed lakes</h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {nearby.analysed.map((c) => (
                  <li key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                    <Link href={cardHref(c)}><strong>{c.name}</strong></Link>
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
