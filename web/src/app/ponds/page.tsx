"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CaseBadge from "@/components/CaseBadge";
import { Guide, Loader } from "@/components/Mascot";
import {
  PONDS_BASE, POND_COLOUR, NOW_WORDS, STATUS_WORDS, acres, authorityLetter, download, getCases, loadPonds,
  type Pond, type PondCase, type PondStatus, type PondSummary,
} from "@/lib/ponds";

const PondMap = dynamic(() => import("@/components/PondMap"), { ssr: false });

const TABS: PondStatus[] = ["vanished", "shrank", "alive"];

// Strongest evidence first: built over, then under plants, then hard to tell; bigger first within each.
const NOW_ORDER: Record<string, number> = { built_or_bare: 0, dried_grassed: 1, unclear: 2 };
function ordered(all: Pond[], status: PondStatus): Pond[] {
  return all
    .filter((p) => p.properties.status === status)
    .sort((a, b) => (NOW_ORDER[a.properties.now ?? ""] ?? 3) - (NOW_ORDER[b.properties.now ?? ""] ?? 3) || b.properties.area_ha - a.properties.area_ha);
}

function csv(list: Pond[]): string {
  const head = "id,status,district,area_acres,water_left_percent,now,lat,lon";
  return [head, ...list.map(({ properties: p }) =>
    [p.id, p.status, `"${p.district ?? ""}"`, (p.area_ha * 2.471).toFixed(2), Math.round(p.water_left * 100), p.now ?? "", p.lat, p.lon].join(","))].join("\n");
}

export default function PondsPage() {
  const [summary, setSummary] = useState<PondSummary | null>(null);
  const [ponds, setPonds] = useState<Pond[] | null>(null);
  const [cases, setCases] = useState<Record<string, PondCase>>({});
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<PondStatus>("vanished");
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(24);

  useEffect(() => {
    loadPonds().then(({ summary, ponds }) => { setSummary(summary); setPonds(ponds); }).catch(() => setError(true));
    getCases().then((r) => setCases(Object.fromEntries(r.cases.map((c) => [c.pond_id, c])))).catch(() => {});
  }, []);

  const show = useMemo(() => ({ vanished: true, shrank: true, alive: tab === "alive" }), [tab]);
  const list = useMemo(() => ordered(ponds ?? [], tab), [ponds, tab]);
  const clear = useMemo(() => ordered(ponds ?? [], "vanished").filter((p) => p.properties.now !== "unclear"), [ponds]);
  const adopted = Object.values(cases).filter((c) => c.stage).length;
  const revived = Object.values(cases).filter((c) => c.revived).length;

  function pick(id: string) {
    setSelected(id);
    const pond = ponds?.find((p) => p.properties.id === id);
    if (!pond) return;
    if (pond.properties.status !== tab) setTab(pond.properties.status);
    const i = ordered(ponds ?? [], pond.properties.status).indexOf(pond);
    if (i >= limit) setLimit(i + 1);
    setTimeout(() => document.getElementById(`pond-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  if (error) {
    return (
      <main>
        <span className="eyebrow">Bring Delhi&rsquo;s ponds back</span>
        <h1>Not ready yet</h1>
        <p className="lede">The pond scan for Delhi hasn&rsquo;t been published yet. Please check back soon.</p>
      </main>
    );
  }
  if (!summary || !ponds) return <main><Loader label="Loading Delhi's ponds" /></main>;

  return (
    <main className="ponds-page">
      <span className="eyebrow">Bring Delhi&rsquo;s ponds back</span>
      <h1>
        {summary.vanished.toLocaleString("en-IN")} of Delhi&rsquo;s ponds have dried up.{" "}
        <span className="accent-win">Adopt one and bring the water back.</span>
      </h1>
      <p className="lede" style={{ maxWidth: 780 }}>
        Ponds soak up rain, refill the ground water and keep streets from flooding. We found every pond in Delhi from
        space. Each lost one now needs someone to look after it: a resident welfare association, a school, a college or
        a company. You adopt it, we write the letter to the agency that owns the land, a public clock shows whether
        they answer, and the satellite tells everyone when the water is back.
      </p>

      <ol className="pond-path" aria-label="How a pond comes back" data-jal-mood="curious"
        data-jal="Delhi has lost many of its ponds. Here's how one comes back: you adopt it, send the letter, and a public clock and the satellite keep everyone honest.">
        <li><b>1</b><span><strong>Adopt</strong> a pond near you</span></li>
        <li><b>2</b><span><strong>Send</strong> the ready letter to the agency that owns the land</span></li>
        <li><b>3</b><span><strong>The clock runs</strong>: the agency has 30 days to answer, in public</span></li>
        <li><b>4</b><span><strong>Fix it</strong> with the agency, and company CSR money if needed</span></li>
        <li><b>5</b><span><strong>Proof from space</strong>: the satellite confirms the water is back</span></li>
      </ol>

      <dl className="stat-tiles" data-jal-mood="worried"
        data-jal="These numbers come from satellite photos of every pond in Delhi: how many dried up, how many are easy to bring back, and how many people have adopted.">
        <div className="stat-tile"><dt>DRIED UP</dt><dd className="changed">{summary.vanished.toLocaleString("en-IN")}</dd><small>About {acres(summary.vanished_ha)} of water lost since {summary.baseline_years.join(", ")}</small></div>
        <div className="stat-tile"><dt>EASY TO BRING BACK</dt><dd>{summary.now.dried_grassed.toLocaleString("en-IN")}</dd><small>Covered in plants, not built on</small></div>
        <div className="stat-tile"><dt>ADOPTED SO FAR</dt><dd>{adopted.toLocaleString("en-IN")}</dd><small><Link href="/ponds/board/">See every case and agency</Link></small></div>
        <div className="stat-tile"><dt>REVIVED</dt><dd className="win">{revived.toLocaleString("en-IN")}</dd><small>Adopted ponds with water back, seen from space</small></div>
      </dl>

      <Guide size={52} className="section-guide" interactive={false} mood="happy">
        {"Start with a pond covered in plants: nobody has built on it, so clearing the silt and weeds can bring the water back by the next monsoon. A built-over pond needs the government to act, and your letter starts that."}
      </Guide>

      <div className="pond-layout">
        <section className="pond-map-wrap" aria-label="Map of Delhi's ponds" data-jal-mood="searching"
          data-jal="Each dot is a pond. Tap one near you to see what happened to it, and adopt it if it needs help.">
          <PondMap ponds={ponds} bbox={summary.bbox} show={show} selected={selected} onSelect={pick} />
          <div className="pond-legend small">
            {TABS.map((s) => (
              <span key={s}><i style={{ background: POND_COLOUR[s] }} />{STATUS_WORDS[s].label}</span>
            ))}
            <span className="muted">Tap a dot to see that pond</span>
          </div>
        </section>

        <section className="pond-list-wrap">
          <div className="pond-tabs" role="tablist">
            {TABS.map((s) => (
              <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? "on" : ""}
                onClick={() => { setTab(s); setLimit(24); }}>
                {s === "vanished" ? "Dried up" : STATUS_WORDS[s].label} <b>{(summary[s] ?? 0).toLocaleString("en-IN")}</b>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: "8px 0 12px" }}>
            {STATUS_WORDS[tab].plain}. {tab === "vanished" || tab === "shrank" ? "Clearest cases first, then by size." : "Biggest first."}
          </p>

          {tab === "vanished" && clear.length > 0 && (
            <div className="pond-actions">
              <button className="button secondary" onClick={() => download("jalrekha-delhi-lost-ponds-letter.txt", "text/plain", authorityLetter(clear.slice(0, 50).map((f) => f.properties), summary))}>
                One letter for the {Math.min(clear.length, 50)} clearest
              </button>
              <button className="button secondary" onClick={() => download("jalrekha-delhi-ponds.csv", "text/csv", csv(ponds))}>
                Download the full list
              </button>
            </div>
          )}

          <ol className="pond-list">
            {list.slice(0, limit).map((f) => {
              const p = f.properties;
              const c = cases[p.id];
              const open = `/ponds/pond/?id=${p.id}`;
              const lost = p.status === "vanished" || p.status === "shrank";
              return (
                <li key={p.id} id={`pond-${p.id}`} className={`pond-card${selected === p.id ? " picked" : ""}`}>
                  {p.thumbs && p.thumbs.length === 2 ? (
                    <div className="pond-photos" onClick={() => pick(p.id)}>
                      {p.thumbs.map((t, i) => (
                        <figure key={t}>
                          <img src={`${PONDS_BASE}/${t}`} alt={`Pond ${p.id} from space, ${i ? "now" : "before"}`} loading="lazy" width={160} height={160} />
                          <figcaption>{t.match(/(\d{4})\.jpg$/)?.[1]}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  <div className="pond-body">
                    <button className="pond-title" onClick={() => pick(p.id)}>
                      <span className="pill" style={{ background: POND_COLOUR[p.status], color: "#fff" }}>{p.status === "vanished" ? "Dried up" : STATUS_WORDS[p.status].label}</span>
                      <strong>About {acres(p.area_ha)}</strong>
                    </button>
                    {lost && <p className="small">{NOW_WORDS[p.now ?? "unclear"]}.{p.status === "shrank" ? ` ${Math.round(p.water_left * 100)}% still wet.` : ""}</p>}
                    <p className="small muted">{p.district ? `${p.district} · ` : ""}{p.lat}, {p.lon}</p>
                    <CaseBadge c={c} />
                    <div className="pond-links small">
                      {lost && !c?.stage ? (
                        <Link className="button pond-adopt" href={open}>Adopt this pond</Link>
                      ) : (
                        <Link href={open}>{c?.stage ? `Looked after by ${c.name}` : "Open this pond"}</Link>
                      )}
                      <Link href={`/check/?lat=${p.lat}&lon=${p.lon}`}>Check this land</Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {list.length > limit && (
            <button className="button secondary" style={{ width: "100%" }} onClick={() => setLimit(limit + 48)}>
              Show more ({(list.length - limit).toLocaleString("en-IN")} left)
            </button>
          )}
        </section>
      </div>

      <section id="pond-method" style={{ maxWidth: 760, marginTop: 40 }}>
        <h2>How we found them</h2>
        <ol className="small" style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          <li>For each year, we took every clear Sentinel-2 satellite photo of Delhi from November to January, after the monsoon, when ponds still hold water and the rice fields have been harvested. Each pixel is 10 metres across.</li>
          <li>A spot counts as water when it reflects light the way water does (a test called MNDWI).</li>
          <li>A <b>pond</b> is a patch of water seen in at least 2 of the years {summary.baseline_years.join(", ")}, bigger than about a fifth of an acre, inside Delhi. The Yamuna, the land along it, and long thin drains and canals are left out.</li>
          <li>To call a pond <b>dried up</b> we use a gentler test, so murky or weedy water still counts as water: none of it held any water in {summary.recent_years.join(" or ")}. <b>Shrunk</b> means less than half did.</li>
          <li>When a group says a pond holds water again, anyone can ask the satellite to look at it now. It reads every clear photo from the last 75 days.</li>
        </ol>
        <p className="notice">
          Be fair: some ponds fill only in very wet years, and the satellite can miss ponds under trees or smaller than
          a fifth of an acre, so the real loss is likely bigger. Look at the two photos and, if you can, visit. The
          letters ask for an inspection, not punishment.
        </p>
        <p className="small muted">Results made on {summary.made}. Satellite data: Copernicus Sentinel-2, read from AWS Open Data.</p>
      </section>
    </main>
  );
}
