"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import CheckMap, { type CatalogLake, type CheckLayers } from "@/components/CheckMap";
import CheckProgress from "@/components/CheckProgress";
import Jal, { Guide, type Mood } from "@/components/Mascot";
import { SearchIcon } from "@/components/SiteHeader";
import Swipe from "@/components/Swipe";
import { seasonLabel } from "@/lib/data";
import { useLang } from "@/lib/lang";
import { STATUS_WORDS, acres, distanceToPond, loadPonds, type Pond } from "@/lib/ponds";
import {
  type Check,
  type FloodEvent,
  type Lang,
  LANGS,
  LEVEL_LABEL,
  type Place,
  PLOT_API_URL,
  RULE_LABEL,
  RULE_STATUS,
  type Report,
  geocode,
  getCheck,
  loadFloodEvents,
  startCheck,
} from "@/lib/plot";

const POLL_MS = 2500;

const LEVEL_MOOD: Record<Report["verdict"]["level"], Mood> = {
  high: "worried",
  watch: "cautious",
  low: "celebrate",
  unknown: "thinking",
};
const DISCLAIMER =
  "Satellite evidence of where water has been, measured from the water's edge seen from space. Not a land survey, not the legal lake boundary (FTL), and not legal advice. Verify with the planning authority and a lawyer before paying.";

const BEFORE_YOU_PAY: Record<Lang, string> = {
  en: "Before you pay",
  kn: "ಹಣ ಕೊಡುವ ಮೊದಲು",
  te: "డబ్బు చెల్లించే ముందు",
  hi: "पैसे देने से पहले",
};

const NEAR_CATALOG_KM = 1.5; // same as CATALOG_MATCH_M in pipeline/jalrekha/plot.py

function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Radius in km of a circle with the lake's area (the catalogue has no outline). */
const km2radius = (ha: number) => Math.sqrt((ha * 0.01) / Math.PI);

const inside = (b: [number, number, number, number], lon: number, lat: number) =>
  lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];

export default function CheckView() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [pin, setPin] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string>("");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // The verdict follows the site's language (header menu), and its own buttons change both.
  const { lang, setLang } = useLang();
  const [layers, setLayers] = useState<CheckLayers>({ satellite: true, water: true, flood: true });
  const [events, setEvents] = useState<FloodEvent[]>([]);
  const [lakes, setLakes] = useState<CatalogLake[] | undefined>();
  const [copied, setCopied] = useState(false);
  const [ponds, setPonds] = useState<Pond[]>([]);

  useEffect(() => {
    const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
    if (!id && Number.isFinite(lat) && Number.isFinite(lon) && params.get("lat")) setPin([lon, lat]);
  }, [id, params]);

  useEffect(() => {
    loadFloodEvents().then(setEvents).catch(() => setEvents([]));
    fetch("/catalog/india.json").then((r) => r.json()).then(setLakes).catch(() => setLakes([]));
    loadPonds().then((r) => setPonds(r.ponds)).catch(() => setPonds([]));
  }, []);

  // Follow a check by id: poll until it is done or failed.
  useEffect(() => {
    if (!id) {
      setCheck(null);
      return;
    }
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const c = await getCheck(id);
        if (stop) return;
        setCheck(c);
        setPin([c.lon, c.lat]);
        setError(null);
        if (c.status === "queued" || c.status === "running") timer = setTimeout(tick, POLL_MS);
      } catch (e) {
        if (!stop) setError(`Could not load this check: ${e instanceof Error ? e.message : "network error"}.`);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  const pick = useCallback((lon: number, lat: number, label = "") => {
    setPin([lon, lat]);
    setAddress(label);
    setError(null);
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setError(null);
    try {
      setPlaces(await geocode(query.trim()));
    } catch (err) {
      setError(`Address search failed: ${err instanceof Error ? err.message : "network error"}.`);
    } finally {
      setSearching(false);
    }
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => pick(p.coords.longitude, p.coords.latitude, "My location"),
      () => setError("Your browser did not share a location. Search for the address or tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function run() {
    if (!pin) return;
    setStarting(true);
    setError(null);
    try {
      const r = await startCheck(pin[1], pin[0], address || undefined);
      router.push(`/check/?id=${encodeURIComponent(r.id)}`);
    } catch (e) {
      setError(`Could not start the check: ${e instanceof Error ? e.message : "network error"}.`);
    } finally {
      setStarting(false);
    }
  }

  function reset() {
    setPin(null);
    setAddress("");
    setPlaces(null);
    router.push("/check/");
  }

  const report = check?.status === "done" ? check.report : undefined;
  const nearest = useMemo(() => {
    if (!pin || !lakes?.length) return null;
    let best: { lake: CatalogLake; d: number } | null = null;
    for (const l of lakes) {
      const d = km(pin[1], pin[0], l.lat, l.lon);
      if (!best || d < best.d) best = { lake: l, d };
    }
    return best;
  }, [pin, lakes]);
  // Ponds found from space (Delhi): warn before anyone buys land that is, or was, a pond.
  const pondHit = useMemo(() => {
    if (!pin || !ponds.length) return null;
    let best: { pond: Pond; d: number } | null = null;
    for (const p of ponds) {
      if (Math.abs(p.properties.lat - pin[1]) > 0.01 || Math.abs(p.properties.lon - pin[0]) > 0.01) continue;
      const d = distanceToPond(pin[0], pin[1], p.geometry);
      if (!best || d < best.d) best = { pond: p, d };
    }
    return best && best.d <= 50 ? best : null;
  }, [pin, ponds]);
  const flood = useMemo(() => {
    if (!pin) return null;
    const e = events.find((ev) => inside(ev.bounds, pin[0], pin[1]));
    return e ? { url: `/floods/${e.id}/overlay.png`, bounds: e.bounds, event: e } : null;
  }, [events, pin]);

  if (!PLOT_API_URL) {
    return (
      <main>
        <h1>Plot Check</h1>
        <p className="notice">Plot Check is not configured in this build (set NEXT_PUBLIC_PLOT_API_URL).</p>
      </main>
    );
  }

  return (
    <main className="check">
      <div className="no-print" data-jal-mood="curious"
        data-jal="Buying or renting? Drop a pin on the exact plot and I'll read every satellite photo of it since 2019: was it lake water, how close is the lake, and did it flood.">
        <span className="eyebrow">Plot Check · before you buy or rent</span>
        <h1>Was this land part of a lake?</h1>
        <p className="lede" style={{ maxWidth: 760 }}>
          Drop a pin on a plot or building. We read every satellite photo of it since 2019 and tell you if lake water
          stood there, how close the lake is, and if it flooded. Choosing land that isn&rsquo;t a filled lake keeps your
          home safe and lets the lake keep doing its job.
        </p>
      </div>

      {!id && (
        <section className="check-pick no-print" data-jal-mood="searching"
          data-jal="Search an address, use your location, or tap the map. Then start the check and give me two to four minutes to look.">
          <form className="search-pill check-search" onSubmit={search} role="search">
            <SearchIcon />
            <input
              aria-label="Address, layout or landmark"
              placeholder="Address, colony or landmark, e.g. Hauz Khas, Delhi"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" disabled={searching || query.trim().length < 3}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          <div className="row" style={{ gap: 8, margin: "10px 0 14px", flexWrap: "wrap" }}>
            <button type="button" className="secondary" onClick={locate}>Use my location</button>
            <span className="small muted">or tap the exact spot on the map</span>
            {lakes && lakes.length > 0 && (
              <span className="small muted">
                <span className="legend-key" style={{ background: "rgba(30,120,220,0.35)", border: "1.5px solid #1e78dc", borderRadius: "50%" }} />{" "}
                {lakes.length.toLocaleString("en-IN")} catalogued lakes across India
              </span>
            )}
          </div>
          {places && (
            <ul className="place-list">
              {places.length === 0 && <li className="small muted">No match in India. Try a nearby landmark, or tap the map.</li>}
              {places.map((p) => (
                <li key={`${p.lat},${p.lon}`}>
                  <button type="button" className="link-button" onClick={() => { pick(p.lon, p.lat, p.label); setPlaces(null); }}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && <p className="notice error" role="alert">{error}</p>}

      {pondHit && (
        <div className="card check-pond" role="alert">
          <strong>
            {pondHit.d === 0 ? "This spot is on a pond" : `This spot is ${Math.round(pondHit.d)} metres from a pond`}
            {pondHit.pond.properties.status === "vanished" || pondHit.pond.properties.status === "shrank"
              ? " that has dried up since 2021." : "."}
          </strong>
          <p className="small" style={{ margin: "6px 0" }}>
            Pond {pondHit.pond.properties.id}, about {acres(pondHit.pond.properties.area_ha)}: {STATUS_WORDS[pondHit.pond.properties.status].plain.toLowerCase()}.
            Land on a filled pond floods in heavy rain and can sink, and building on a water body can be against the law.
            Ask the seller for the land records before you pay anything.
          </p>
          <Link className="small" href={`/ponds/pond/?id=${pondHit.pond.properties.id}`}>See the pond, and help bring it back</Link>
        </div>
      )}

      <div className={report ? "check-grid" : undefined}>
        <div className="map-wrap check-map-wrap">
          <CheckMap
            pin={pin}
            onPick={id ? undefined : (lon, lat) => pick(lon, lat)}
            window={report?.facts.window.bounds}
            satelliteUrl={report?.facts.images.after?.url}
            waterUrl={report?.facts.images.water_frequency?.url}
            flood={report ? flood : null}
            layers={layers}
            lakes={lakes}
          />
          {report && (
            <div className="layers check-layers no-print" role="group" aria-label="Map layers">
              <label><input type="checkbox" checked={layers.satellite} onChange={(e) => setLayers({ ...layers, satellite: e.target.checked })} /> Satellite ({report.facts.images.after ? seasonLabel(report.facts.images.after.season!) : "latest"})</label>
              <label><input type="checkbox" checked={layers.water} onChange={(e) => setLayers({ ...layers, water: e.target.checked })} /> <span className="legend-key" style={{ background: "#1e6edc" }} /> Where water has been</label>
              {flood && <label><input type="checkbox" checked={layers.flood} onChange={(e) => setLayers({ ...layers, flood: e.target.checked })} /> <span className="legend-key" style={{ background: "#7c3aed" }} /> Flood, {flood.event.date}</label>}
            </div>
          )}
        </div>

        {report && <ReportPanel report={report} lang={lang} setLang={setLang} />}
      </div>

      {!id && pin && (
        <div className="check-go no-print">
          <div>
            <strong>{address || `${pin[1].toFixed(5)}, ${pin[0].toFixed(5)}`}</strong>
            <div className="small muted">The check reads a 1.2-kilometre square around this pin.</div>
            {nearest && km2radius(nearest.lake.ha) > nearest.d && (
              <div className="small" style={{ color: "var(--danger)" }}>
                This pin looks like it&rsquo;s in the water of {nearest.lake.name}. Plot Check is for land near a lake:
                tap the plot or building itself.
              </div>
            )}
            {nearest && (nearest.d <= NEAR_CATALOG_KM ? (
              <div className="small" style={{ color: "var(--brand-deep)" }}>
                Nearest catalogued lake: {nearest.lake.name}, {nearest.d < 1 ? `${Math.round(nearest.d * 1000)} metres` : `${nearest.d.toFixed(1)} kilometres`} from the pin.
              </div>
            ) : (
              <div className="small" style={{ color: "var(--amber-ink)" }}>
                No catalogued lake within {NEAR_CATALOG_KM} km (nearest: {nearest.lake.name}, {nearest.d.toFixed(1)} km). The check still reads the
                water history here, but can&rsquo;t name a lake or apply its size-based buffer rule. Blue circles on the map are the lakes we know.
              </div>
            ))}
          </div>
          <button type="button" className="button" onClick={run} disabled={starting}>
            {starting ? "Starting…" : "Check this spot"}
          </button>
        </div>
      )}

      {!id && !pin && (
        <Guide size={56} className="section-guide no-print" interactive>
          Search for an address or tap the map. I&rsquo;ll look back through eight years of satellite passes for that
          exact spot.
        </Guide>
      )}

      {check && (check.status === "queued" || check.status === "running") && (
        <CheckProgress progress={check.progress} since={check.created} />
      )}

      {check?.status === "error" && (
        <div className="notice error">
          The check could not finish: {check.error ?? "unknown error"}.{" "}
          <button type="button" className="link-button" onClick={() => startCheck(check.lat, check.lon, check.address ?? undefined).then(() => router.refresh())}>
            Try again
          </button>
        </div>
      )}

      {report && (
        <>
          <ReportDetails report={report} />
          <div className="row no-print" style={{ gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            <button type="button" className="button" onClick={() => window.print()}>Save as PDF</button>
            <button type="button" className="secondary" onClick={() => {
              navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
            }}>{copied ? "Link copied" : "Copy link"}</button>
            <button type="button" className="secondary" onClick={reset}>Check another spot</button>
          </div>
        </>
      )}

      <p className="small muted disclaimer" style={{ marginTop: 28 }}>{DISCLAIMER}</p>
    </main>
  );
}

function ReportPanel({ report, lang, setLang }: { report: Report; lang: Lang; setLang: (l: Lang) => void }) {
  const v = report.verdict;
  const t = v.text[lang];
  return (
    <section className={`card verdict verdict-${v.level}`} aria-labelledby="verdict-title" data-jal-mood="thinking" data-no-translate
      data-jal="This is my answer for this spot, in plain words. Read the list under it: those are the things to check before you pay.">
      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 8 }}>
          <Jal size={48} mood={LEVEL_MOOD[v.level]} interactive={false} className="no-print" />
          <span className={`pill level-${v.level}`}>{LEVEL_LABEL[v.level]}</span>
        </span>
        <div className="segmented no-print" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.id}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <h2 id="verdict-title" lang={lang} style={{ margin: "14px 0 8px" }}>{t.headline}</h2>
      <p lang={lang}>{t.summary}</p>
      <h3 lang={lang} style={{ fontSize: "1rem", margin: "16px 0 6px" }}>{BEFORE_YOU_PAY[lang]}</h3>
      <ul lang={lang} className="check-list">
        {t.checks.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <p className="small muted" style={{ marginTop: 14 }}>
        {report.facts.address && <>{report.facts.address} · </>}
        {report.facts.lat.toFixed(5)}, {report.facts.lon.toFixed(5)} · checked {report.made.slice(0, 10)} ·{" "}
        {{ bedrock: "explained by Claude on Amazon Bedrock", translate: "translated by Amazon Translate", template: "standard wording" }[v.text_source]}
      </p>
    </section>
  );
}

function SeasonStrip({ report }: { report: Report }) {
  const years = Array.from(new Set(report.facts.history.map((h) => h.season.split("-")[0]))).sort();
  const cell = (season: string) => {
    const h = report.facts.history.find((x) => x.season === season);
    if (!h || h.status !== "ok") return { cls: "nodata", label: "not enough clear images" };
    return h.water_at_pin ? { cls: "water", label: "water at the pin" } : { cls: "dry", label: "no water at the pin" };
  };
  return (
    <div className="season-strip" role="table" aria-label="Water at the pin, season by season">
      <div role="row" className="season-row">
        <span role="columnheader" />
        {years.map((y) => <span role="columnheader" key={y} className="small muted">{y}</span>)}
      </div>
      {(["dry", "post"] as const).map((kind) => (
        <div role="row" className="season-row" key={kind}>
          <span role="rowheader" className="small">{kind === "dry" ? "Dry season (Jan–Apr)" : "After monsoon (Nov–Dec)"}</span>
          {years.map((y) => {
            const c = cell(`${y}-${kind}`);
            return <span role="cell" key={y} className={`season-cell ${c.cls}`} title={`${seasonLabel(`${y}-${kind}`)}: ${c.label}`}><span className="sr-only">{c.label}</span></span>;
          })}
        </div>
      ))}
      <div className="legend small" style={{ marginTop: 8 }}>
        <span><i className="season-cell water" /> water at the pin</span>
        <span><i className="season-cell dry" /> no water</span>
        <span><i className="season-cell nodata" /> not enough clear images</span>
      </div>
    </div>
  );
}

function ReportDetails({ report }: { report: Report }) {
  const f = report.facts;
  const d = f.distance_to_extent_m;
  const img = f.images;
  const onWater = f.dry_seasons_checked > 0 && f.dry_seasons_with_water.length === f.dry_seasons_checked;
  return (
    <section className="section" style={{ marginTop: 28 }} data-jal-mood="scanning"
      data-jal="And this is what the satellites saw at your pin, year by year: water, distance to the lake, and past floods.">
      {onWater && (
        <Guide size={52} className="section-guide no-print" tone="warn" interactive={false}>
          {`This pin is on open water in every dry season since 2019: it's ${f.nearest_lake ? f.nearest_lake.name : "the lake"} itself, not land beside it. To check a plot, go back and drop the pin on the plot or building.`}
        </Guide>
      )}
      <h2 className="section-title">What the satellites saw</h2>
      <dl className="stat-tiles">
        <div className="stat-tile">
          <dt>WATER AT THIS SPOT</dt>
          <dd className={f.dry_seasons_with_water.length ? "changed" : undefined}>
            {f.dry_seasons_with_water.length} of {f.dry_seasons_checked}
            <small>dry seasons since 2019</small>
          </dd>
        </div>
        <div className="stat-tile">
          <dt>AFTER THE MONSOON</dt>
          <dd className={f.post_seasons_with_water.length ? "changed" : undefined}>
            {f.post_seasons_with_water.length ? `wet ${f.post_seasons_with_water.length}×` : "dry"}
            <small>{f.post_seasons_with_water.length ? f.post_seasons_with_water.map((s) => s.split("-")[0]).join(", ") : "every November–December seen"}</small>
          </dd>
        </div>
        <div className="stat-tile">
          <dt>LAKE&rsquo;S LARGEST WATER EXTENT</dt>
          <dd className={d !== null && d <= 30 ? "changed" : undefined}>
            {d === null ? "none nearby" : d === 0 ? "on it" : `${d} metres away`}
            <small>{f.nearest_lake ? f.nearest_lake.name : d === null ? "within 600 metres" : "unnamed water body"}</small>
          </dd>
        </div>
        <div className="stat-tile">
          <dt>MAPPED FLOODS</dt>
          <dd className={f.floods.some((x) => x.flooded_at_pin) ? "changed" : undefined}>
            {f.floods.length === 0 ? "not mapped" : f.floods.some((x) => x.flooded_at_pin) ? "flooded" : "not seen"}
            <small>{f.floods.length ? f.floods.map((x) => `${x.name.split(",")[0]}, ${x.date}`).join("; ") : "no radar flood map covers this area yet"}</small>
          </dd>
        </div>
      </dl>

      <h3 style={{ marginTop: 24 }}>Season by season, at the pin</h3>
      <SeasonStrip report={report} />

      <h3 style={{ marginTop: 24 }}>Can you build here? No-build zones around the lake</h3>
      <div className="table-scroll"><table>
        <thead><tr><th>Rule</th><th>Distance from the water</th><th>Is it law?</th><th>Your spot</th></tr></thead>
        <tbody>
          {f.buffer_rules.map((r) => (
            <tr key={r.rule}>
              <td>{RULE_LABEL[r.rule]}</td>
              <td>{r.width_m} metres</td>
              <td>{RULE_STATUS[r.status]}</td>
              <td>{d === 0 ? "On the lake itself" : r.inside ? <strong>Inside the zone</strong> : "Outside the zone"}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="small muted">
        We measure from the furthest the water reached since 2019. The official lake line on government maps can be
        different, so ask the city planning office before you buy.
      </p>

      {f.floods.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Floods seen by radar</h3>
          <ul>
            {f.floods.map((x) => (
              <li key={x.id}>
                <strong>{x.name}</strong> ({x.date}):{" "}
                {x.flooded_at_pin ? "standing water at this spot" : "no standing water at this spot"}
                {x.share_flooded_250m !== null && `, ${Math.round(x.share_flooded_250m * 100)}% of open ground within 250 metres flooded`}.
              </li>
            ))}
          </ul>
          <p className="small muted">
            Sentinel-1 radar sees floods through cloud, on open ground. It misses water between tall buildings and
            floods that drained before the satellite passed, so &ldquo;not seen&rdquo; is not &ldquo;flood-free&rdquo;.
          </p>
        </>
      )}

      {img.before?.url && img.after?.url && !onWater && (
        <>
          <h3 style={{ marginTop: 24 }}>Then and now</h3>
          <Swipe
            before={img.before.url}
            after={img.after.url}
            beforeLabel={seasonLabel(img.before.season!)}
            afterLabel={seasonLabel(img.after.season!)}
            overlay={<span className="crosshair" aria-hidden="true" />}
          />
          <p className="small muted">Sentinel-2 true colour, 10-metre pixels, 1.2 kilometres across. The crosshair is your pin.</p>
        </>
      )}

      {f.nearest_lake && (
        <div className="card protect">
          <Jal size={56} mood="happy" interactive={false} className="no-print" />
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Help protect {f.nearest_lake.name}</h3>
            <p style={{ margin: "0 0 10px" }}>
              This lake holds rain for everyone around it. If you see soil dumped or walls going up on it, report it to the
              city. This report, with its dated satellite photos, is your proof.
            </p>
            <Link className="button secondary" href={`/lakes/view/?id=${f.nearest_lake.id}`}>See this lake</Link>
          </div>
        </div>
      )}

      <details className="small" style={{ marginTop: 20 }}>
        <summary>How this was worked out</summary>
        <p>
          For each dry season (January–April) and post-monsoon season (November–December) since 2019, JalRekha takes
          the median of the cloud-free Sentinel-2 passes and marks open water where the water index (MNDWI) is above a
          threshold fitted to this area. A season counts as &ldquo;water at the pin&rdquo; when most of the 3 × 3
          pixels around it are water. The lake&rsquo;s largest extent is every pixel that held water in any dry
          season, in patches of 500 m² or more. Floods come from Sentinel-1 radar on the flood morning compared with
          the same orbit&rsquo;s other passes that monsoon. Result id {report.id}, computed in {report.seconds} s.
        </p>
      </details>
    </section>
  );
}
