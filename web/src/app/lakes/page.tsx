"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { SearchIcon } from "@/components/SiteHeader";
import { type OsmLake, cards, loadCatalog, placeLabel } from "@/lib/catalog";
import { type LakeSummary, loadIndex } from "@/lib/data";

const IndiaMap = dynamic(() => import("@/components/IndiaMap"), { ssr: false });

type StatusFilter = "all" | "analysed" | "queued";
type Sort = "relevance" | "largest" | "name";
const PAGE = 48;

export default function AllLakes() {
  const [lakes, setLakes] = useState<LakeSummary[] | null>(null);
  const [osm, setOsm] = useState<OsmLake[] | null>(null);
  const [state, setState] = useState("All");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("relevance");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    loadIndex().then((i) => setLakes(i.lakes)).catch(() => setLakes([]));
    loadCatalog().then(setOsm);
    // Filters live in the URL so a filtered list can be shared.
    const p = new URLSearchParams(window.location.search);
    if (p.get("state")) setState(p.get("state")!);
    if (p.get("q")) setQ(p.get("q")!);
    const st = p.get("status");
    if (st === "analysed" || st === "queued") setStatus(st);
    const so = p.get("sort");
    if (so === "largest" || so === "name") setSort(so);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (state !== "All") p.set("state", state);
    if (status !== "all") p.set("status", status);
    if (sort !== "relevance") p.set("sort", sort);
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [state, status, sort, q]);

  const all = useMemo(() => cards(lakes ?? [], osm ?? []), [lakes, osm]);
  const states = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of all) n.set(c.state, (n.get(c.state) ?? 0) + 1);
    return Array.from(n.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all.filter(
      (c) =>
        (state === "All" || c.state === state) &&
        (status === "all" || (status === "analysed" ? c.analysed : !c.analysed)) &&
        (!needle || `${c.name} ${placeLabel(c)}`.toLowerCase().includes(needle)),
    );
    if (sort === "largest") return [...list].sort((a, b) => (b.areaAc ?? 0) - (a.areaAc ?? 0));
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    // Relevance: analysed lakes by changed area, then lakes with satellite images, then largest.
    const rank = (c: (typeof list)[number]) => (c.analysed ? 0 : c.thumb ? 1 : 2);
    return [...list].sort(
      (a, b) => rank(a) - rank(b) || (b.flaggedAc ?? 0) - (a.flaggedAc ?? 0) || (b.areaAc ?? 0) - (a.areaAc ?? 0),
    );
  }, [all, state, status, sort, q]);

  useEffect(() => setLimit(PAGE), [state, status, sort, q]);

  const analysed = all.filter((c) => c.analysed).length;
  const loading = lakes === null || osm === null;
  const reset = () => {
    setState("All");
    setStatus("all");
    setSort("relevance");
    setQ("");
  };

  return (
    <main>
      <Link href="/" className="small muted" style={{ textDecoration: "none" }}>← Back</Link>
      <div className="section-head" style={{ marginTop: 20 }}>
        <div style={{ flex: "1 1 520px", minWidth: 0 }}>
          <h1>All lakes</h1>
          <p className="lede">
            {loading
              ? "Loading lakes across India…"
              : `${all.length.toLocaleString("en-IN")} named lakes, tanks and reservoirs in ${states.length} states and union territories · ${analysed} analysed · showing ${shown.length.toLocaleString("en-IN")}`}
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

      <div className="filters">
        <div className="row" style={{ gap: 12 }}>
          <label className="small" style={{ fontWeight: 600 }} htmlFor="state">State</label>
          <select id="state" value={state} onChange={(e) => setState(e.target.value)} style={{ width: "auto", minWidth: 220 }}>
            <option value="All">All of India</option>
            {states.map(([s, n]) => (
              <option key={s} value={s}>{s} ({n.toLocaleString("en-IN")})</option>
            ))}
          </select>
          <label className="small" style={{ fontWeight: 600 }} htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: "auto" }}>
            <option value="relevance">Most change first</option>
            <option value="largest">Largest first</option>
            <option value="name">A to Z</option>
          </select>
        </div>
        <div className="segmented" role="group" aria-label="Filter by status">
          {(["all", "analysed", "queued"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={s === status} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : s === "analysed" ? "Analysed" : "Queued"}
            </button>
          ))}
        </div>
      </div>

      {!loading && shown.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <IndiaMap lakes={shown} />
        </div>
      )}

      {loading ? (
        <p className="muted">Loading lakes…</p>
      ) : shown.length ? (
        <>
          <div className="lake-grid">{shown.slice(0, limit).map((c) => <LakeCard key={c.id} c={c} />)}</div>
          {shown.length > limit && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
              <button type="button" className="secondary" onClick={() => setLimit((n) => n + PAGE * 2)}>
                Show more ({(shown.length - limit).toLocaleString("en-IN")} left)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty">
          <p style={{ margin: "0 0 16px", fontSize: 18, color: "var(--body)" }}>No lakes match these filters.</p>
          <button type="button" onClick={reset}>Clear filters</button>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 48, maxWidth: 760 }}>
        Change detected from satellite imagery, not proof of encroachment. Queued lakes are named water bodies of 1 hectare
        or more mapped on OpenStreetMap (© OpenStreetMap contributors, ODbL), drawn from their outline; each is analysed
        once its outline is checked. Analysed lakes show results as of the latest run.
      </p>
    </main>
  );
}
