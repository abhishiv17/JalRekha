"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { EmptyState, Guide } from "@/components/Mascot";
import { SearchIcon } from "@/components/SiteHeader";
import { type Card, KIND_LABELS, type OsmLake, type StatusKey, cards, loadCatalog, loadKinds, placeLabel, statusOf } from "@/lib/catalog";
import { type LakeSummary, loadIndex } from "@/lib/data";

const IndiaMap = dynamic(() => import("@/components/IndiaMap"), { ssr: false });

type StatusFilter = "all" | StatusKey;
type Sort = "change" | "recent" | "largest" | "name";
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All lakes",
  changed: "Shrinking",
  nochange: "Stable",
  nodata: "Too cloudy to tell",
  queued: "Not tracked yet",
};
const PAGE = 48;

function Skeleton() {
  return (
    <div className="lake-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="skeleton" style={{ aspectRatio: "4 / 3" }} />
          <div className="skeleton" style={{ height: 20, width: "60%" }} />
          <div className="skeleton" style={{ height: 14, width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

export default function AllLakes() {
  const [lakes, setLakes] = useState<LakeSummary[] | null>(null);
  const [osm, setOsm] = useState<OsmLake[] | null>(null);
  const [kinds, setKinds] = useState<Record<string, string[]>>({});
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState("All");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState("any");
  const [sort, setSort] = useState<Sort>("change");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    loadIndex()
      .then((i) => {
        setLakes(i.lakes);
        loadKinds(i.lakes.map((l) => l.id)).then(setKinds);
      })
      .catch(() => {
        setLakes([]);
        setFailed(true);
      });
    loadCatalog().then(setOsm);
    const p = new URLSearchParams(window.location.search);
    if (p.get("state")) setState(p.get("state")!);
    if (p.get("q")) setQ(p.get("q")!);
    const st = p.get("status");
    if (st && st in STATUS_LABELS) setStatus(st as StatusFilter);
    if (p.get("kind") && p.get("kind")! in KIND_LABELS) setKind(p.get("kind")!);
    const so = p.get("sort");
    if (so === "recent" || so === "largest" || so === "name") setSort(so);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (state !== "All") p.set("state", state);
    if (status !== "all") p.set("status", status);
    if (kind !== "any") p.set("kind", kind);
    if (sort !== "change") p.set("sort", sort);
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    setLimit(PAGE);
  }, [state, status, kind, sort, q]);

  const all = useMemo<Card[]>(
    () => cards(lakes ?? [], osm ?? []).map((c) => (c.analysed ? { ...c, kinds: kinds[c.id] ?? [] } : c)),
    [lakes, osm, kinds],
  );
  const states = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of all) n.set(c.state, (n.get(c.state) ?? 0) + 1);
    return Array.from(n.entries()).filter(([s]) => s).sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all.filter(
      (c) =>
        (state === "All" || c.state === state) &&
        (status === "all" || statusOf(c).key === status) &&
        (kind === "any" || (c.kinds ?? []).includes(kind)) &&
        (!needle || `${c.name} ${placeLabel(c)}`.toLowerCase().includes(needle)),
    );
    const by: Record<Sort, (a: Card, b: Card) => number> = {
      // Delhi first (the hackathon's home), then most lake lost.
      change: (a, b) => Number(b.city === "Delhi") - Number(a.city === "Delhi") || (b.flaggedAc ?? -1) - (a.flaggedAc ?? -1) || (b.areaAc ?? 0) - (a.areaAc ?? 0),
      recent: (a, b) => (b.firstSeen ?? "").localeCompare(a.firstSeen ?? "") || (b.flaggedAc ?? -1) - (a.flaggedAc ?? -1),
      largest: (a, b) => (b.areaAc ?? 0) - (a.areaAc ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [all, state, status, kind, sort, q]);

  const analysedShown = shown.filter((c) => c.analysed);
  const queuedShown = shown.filter((c) => !c.analysed);
  const queuedSorted = sort === "change" || sort === "recent"
    ? [...queuedShown].sort((a, b) => Number(!!b.thumb) - Number(!!a.thumb) || (b.areaAc ?? 0) - (a.areaAc ?? 0))
    : queuedShown;
  const loading = lakes === null || osm === null;
  const analysedTotal = all.filter((c) => c.analysed).length;
  // Jal reacts to whatever the filters currently show.
  const guide = (() => {
    const a = analysedShown.length, n = queuedShown.length;
    const where = state === "All" ? "" : ` in ${state}`;
    if (q.trim()) {
      const m = shown.length === 1 ? `1 lake matches "${q.trim()}".` : `${shown.length.toLocaleString("en-IN")} lakes match "${q.trim()}".`;
      if (shown.length === 1) return a ? `${m} I track it; open it to see every year since 2019.` : `${m} I don't track it yet, but you can still check plots near it.`;
      return a
        ? `${m} ${a === shown.length ? "I track all of them" : `I track ${a} of them`}; open one to see every year since 2019.`
        : `${m} I don't track these yet, but you can still check plots near them.`;
    }
    if (status === "changed") return `${a} lakes${where} where part of the lake turned into land. Most lost first.`;
    if (status === "nochange") return `${a} lakes${where} that kept their size since 2019.`;
    if (status === "nodata") return `${a} lakes${where} where clouds hid too many years. I won't guess.`;
    if (status === "queued") return `${n.toLocaleString("en-IN")} lakes${where} I don't track yet. That doesn't mean they're fine; I just haven't looked.`;
    if (kind !== "any") return `Lakes with at least one spot of ${(KIND_LABELS[kind] ?? kind).toLowerCase()}${where}.`;
    if (state !== "All" && a === 0) return `I don't track a lake in ${state} yet. The ${n.toLocaleString("en-IN")} below are on the map.`;
    if (state !== "All") return `${state}: ${a} tracked, ${n.toLocaleString("en-IN")} more on the map. Orange means the lake is shrinking.`;
    return "Orange means the lake is shrinking; green means it kept its size. Blue dots on the map are lakes I don't track yet.";
  })();
  const reset = () => {
    setState("All");
    setStatus("all");
    setKind("any");
    setSort("change");
    setQ("");
  };

  return (
    <main>
      <span className="eyebrow">Lakes</span>
      <div className="section-head" style={{ marginTop: 4 }}>
        <div style={{ flex: "1 1 520px", minWidth: 0 }}>
          <h1>Lakes</h1>
          <p className="lede">
            {loading
              ? "Loading lakes…"
              : `${analysedTotal} lakes tracked closely · ${(all.length - analysedTotal).toLocaleString("en-IN")} more on the map across ${states.length} states and union territories.`}
          </p>
        </div>
        <div style={{ flex: "0 1 340px", minWidth: 0 }}>
          <label htmlFor="lake-search" className="small" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Search by lake, town or state
          </label>
          <div className="search-pill">
            <SearchIcon />
            <input id="lake-search" type="search" placeholder="e.g. Jakkur, Udaipur, Kerala" value={q}
              onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="filters" role="search" aria-label="Filter lakes">
        <div className="field" style={{ flex: "1 1 200px" }}>
          <label htmlFor="state">State</label>
          <select id="state" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="All">All of India</option>
            {states.map(([s, n]) => <option key={s} value={s}>{s} ({n.toLocaleString("en-IN")})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="kind">What happened</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="any">Any</option>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 170px" }}>
          <label htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="change">Most lake lost first</option>
            <option value="recent">Most recent first</option>
            <option value="largest">Largest lake</option>
            <option value="name">A to Z</option>
          </select>
        </div>
      </div>

      {failed && <p className="notice error">Tracked lakes could not be loaded. The map of all lakes below still works.</p>}

      {loading ? (
        <Skeleton />
      ) : shown.length === 0 ? (
        <EmptyState title="No lakes match these filters">
          <p>Try another state, status or name.</p>
          <button type="button" onClick={reset} style={{ marginTop: 8 }}>Clear filters</button>
        </EmptyState>
      ) : (
        <>
          <Guide size={52} className="catalog-guide">{guide}</Guide>
          {analysedShown.length > 0 && (
            <section aria-labelledby="analysed-title" style={{ marginBottom: 56 }}>
              <div className="count-head">
                <h2 id="analysed-title">Lakes we track</h2>
                <span className="muted">{analysedShown.length} with results from the full pipeline · flags not yet hand-checked</span>
              </div>
              <div className="lake-grid">{analysedShown.map((c) => <LakeCard key={c.id} c={c} />)}</div>
            </section>
          )}

          {queuedSorted.length > 0 && (
            <section aria-labelledby="queued-title">
              <div className="count-head">
                <h2 id="queued-title">All lakes in India</h2>
                <span className="muted">
                  {queuedSorted.length.toLocaleString("en-IN")} named lakes from OpenStreetMap · queued, no results yet
                </span>
              </div>
              <div style={{ marginBottom: 28 }}><IndiaMap lakes={shown} /></div>
              <div className="lake-grid">{queuedSorted.slice(0, limit).map((c) => <LakeCard key={c.id} c={c} />)}</div>
              {queuedSorted.length > limit && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
                  <button type="button" className="secondary" onClick={() => setLimit((n) => n + PAGE * 2)}>
                    Show more ({(queuedSorted.length - limit).toLocaleString("en-IN")} left)
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <p className="small muted" style={{ marginTop: 48, maxWidth: 760 }}>
        Change detected from satellite imagery, not proof of encroachment. Catalogue lakes are named water bodies of 1
        hectare or more mapped on OpenStreetMap (© OpenStreetMap contributors, ODbL); a queued lake shows no numbers
        because it has not been analysed, not because nothing changed.
      </p>
    </main>
  );
}
