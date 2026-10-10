"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import CaseBadge from "@/components/CaseBadge";
import { Guide, Loader } from "@/components/Mascot";
import {
  ADOPTERS, AGENCIES, NOW_WORDS, PONDS_BASE, SPACE_WORDS, STAGES, STAGE_WORDS, STATUS_WORDS,
  acres, adoptPond, agencyLetter, checkFromSpace, csrProposal, download, getCase, loadPonds, mapLink, moveStage,
  saveKey, savedKey, type Pond, type PondCase, type PondSummary, type Stage,
} from "@/lib/ponds";

const PondMap = dynamic(() => import("@/components/PondMap"), { ssr: false });

const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function boxAround(p: Pond): [number, number, number, number] {
  const d = 0.004;
  return [p.properties.lon - d, p.properties.lat - d, p.properties.lon + d, p.properties.lat + d];
}

function PondView() {
  const id = useSearchParams().get("id") ?? "";
  const [summary, setSummary] = useState<PondSummary | null>(null);
  const [pond, setPond] = useState<Pond | null | undefined>(undefined);
  const [c, setCase] = useState<PondCase | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", kind: "rwa", agency: "unsure" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pasted, setPasted] = useState("");

  const refresh = useCallback(() => getCase(id).then((r) => setCase(r.case)).catch(() => {}), [id]);

  useEffect(() => {
    if (!id) return;
    loadPonds().then(({ summary, ponds }) => {
      setSummary(summary);
      setPond(ponds.find((p) => p.properties.id === id) ?? null);
    }).catch(() => setPond(null));
    refresh();
    setKey(savedKey(id));
  }, [id, refresh]);

  // While the satellite is looking, ask again every few seconds.
  useEffect(() => {
    if (c?.check_status !== "running") return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [c?.check_status, refresh]);

  if (pond === undefined) return <main><Loader label="Loading the pond" /></main>;
  if (!pond || !summary) {
    return (
      <main>
        <h1>Pond not found</h1>
        <p className="lede">There is no pond {id ? `called ${id}` : "with that link"}. <Link href="/ponds/">See all of Delhi&rsquo;s ponds</Link>.</p>
      </main>
    );
  }

  const p = pond.properties;
  const lost = p.status === "vanished" || p.status === "shrank";
  const adopted = !!c?.stage;
  const caseUrl = typeof window !== "undefined" ? `${window.location.origin}/ponds/pond/?id=${p.id}` : "";
  const stageIndex = c?.stage ? STAGES.indexOf(c.stage) : -1;
  const next: Stage | undefined = STAGES[stageIndex + 1];
  const latest = c?.checks?.length ? c.checks[c.checks.length - 1] : null;
  const who = adopted ? { name: c!.name ?? "", kind: c!.kind ?? "person", agency: c!.agency ?? "unsure" } : form;

  async function adopt(e: React.FormEvent) {
    e.preventDefault();
    setBusy("adopt");
    setMessage(null);
    try {
      const r = await adoptPond(p.id, form.name.trim(), form.kind, form.agency);
      saveKey(p.id, r.key);
      setKey(r.key);
      setNewKey(r.key);
      setCase(r.case);
      setMessage({ text: `Thank you. ${form.name.trim()} now looks after this pond. Your next step is below.` });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not adopt the pond.", error: true });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function advance() {
    if (!key || !next) return;
    setBusy("stage");
    setMessage(null);
    try {
      const r = await moveStage(p.id, key, next, note);
      setCase(r.case);
      setNote("");
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not update the pond.", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function look() {
    setBusy("check");
    setMessage(null);
    try {
      const r = await checkFromSpace(p.id);
      if (r.fresh) setMessage({ text: "The satellite looked at this pond in the last few hours; the latest result is below." });
      await refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not start the check.", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="pond-page">
      <Link href="/ponds/" className="small">&larr; All of Delhi&rsquo;s ponds</Link>
      <span className="eyebrow" style={{ display: "block", marginTop: 12 }}>Pond {p.id}{p.district ? ` · ${p.district}` : ""}</span>
      <h1>
        {p.status === "vanished" ? "This pond has dried up." : p.status === "shrank" ? "This pond is shrinking." :
          p.status === "came_back" ? "Water came back here." : "This pond still holds water."}
        {lost && !c?.revived && <span className="accent-win"> {adopted ? "Help bring it back." : "Adopt it and bring it back."}</span>}
        {c?.revived && <span className="accent-win"> Water is back, seen from space.</span>}
      </h1>
      <p className="lede">
        About {acres(p.area_ha)}. {STATUS_WORDS[p.status].plain}.{lost ? ` ${NOW_WORDS[p.now ?? "unclear"]}.` : ""}
      </p>
      <CaseBadge c={c} />

      <div className="pond-detail">
        <div>
          {p.thumbs && (
            <div className="pond-detail-photos">
              {p.thumbs.map((t, i) => (
                <figure key={t}>
                  <img src={`${PONDS_BASE}/${t}`} alt={`Pond ${p.id} from space, ${i ? "later" : "before"}`} />
                  <figcaption>{t.match(/(\d{4})\.jpg$/)?.[1]} {i ? "(after)" : "(before)"}</figcaption>
                </figure>
              ))}
              {latest?.photo_url && (
                <figure>
                  <img src={latest.photo_url} alt={`Pond ${p.id} from space, ${latest.latest_clear}`} crossOrigin="anonymous" />
                  <figcaption>{latest.latest_clear} (latest)</figcaption>
                </figure>
              )}
            </div>
          )}
          <PondMap ponds={[pond]} bbox={boxAround(pond)} show={{ [p.status]: true }} selected={null} onSelect={() => {}} />
          <p className="small muted" style={{ marginTop: 6 }}>
            {p.lat}, {p.lon} · <a href={mapLink(p)} target="_blank" rel="noreferrer">Open in Maps</a> ·{" "}
            <Link href={`/check/?lat=${p.lat}&lon=${p.lon}`}>Check this land</Link>
          </p>
        </div>

        <div>
          <section className="card pond-clock" aria-label="The path back to water">
            <h2 style={{ marginTop: 0 }}>The path back to water</h2>
            <ol className="stage-list">
              {STAGES.map((s, i) => {
                const h = c?.history.find((x) => x.stage === s);
                const state = i < stageIndex || (i === stageIndex && s !== "sent") ? "done" : i === stageIndex ? "now" : "todo";
                return (
                  <li key={s} className={`stage ${h ? state : "todo"}`}>
                    <span className="dot" aria-hidden="true" />
                    <div>
                      <strong>{STAGE_WORDS[s].label}</strong>
                      {h ? <span className="small muted"> · {when(h.at)}</span> : null}
                      {h?.note && <p className="small">{h.note}</p>}
                      {s === "sent" && c?.stage === "sent" && c.waiting_days !== undefined && (
                        <p className={`small ${c.overdue ? "overdue" : ""}`}>
                          {c.overdue ? `Overdue: no answer in ${c.waiting_days} days.` : `Day ${c.waiting_days} of 30 for the agency to answer.`}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
              <li className={`stage ${c?.revived ? "done revived" : "todo"}`}>
                <span className="dot" aria-hidden="true" />
                <div>
                  <strong>Revived: water seen from space</strong>
                  {c?.space && <span className="small muted"> · {SPACE_WORDS[c.space.verdict]}{c.space.date ? ` on ${when(c.space.date)}` : ""}</span>}
                  {c?.claim_not_seen && <p className="small overdue">The group says water is back, but the latest clear photo shows none.</p>}
                </div>
              </li>
            </ol>
          </section>

          {message && <p className={`notice ${message.error ? "error" : "info"}`}>{message.text}</p>}

          {lost && !adopted && (
            <form className="card adopt-form" onSubmit={adopt}>
              <h2 style={{ marginTop: 0 }}>Adopt this pond</h2>
              <p className="small">You don&rsquo;t need money. You need a group that will send one letter, follow up, and visit now and then.</p>
              <label>Your group&rsquo;s name
                <input required minLength={3} maxLength={120} value={form.name} placeholder="e.g. Sector 7 RWA, Rohini"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>What kind of group?
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(ADOPTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Who owns the land?
                <select value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })}>
                  {Object.entries(AGENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <small className="muted">If you don&rsquo;t know, the letter goes to the District Magistrate, who keeps the land records{p.district ? ` for ${p.district}` : ""}.</small>
              </label>
              <button className="button" disabled={!!busy}>{busy === "adopt" ? "Adopting…" : "Adopt this pond"}</button>
              <p className="small muted">Your group&rsquo;s name is shown publicly on this pond and on the agency board.</p>
            </form>
          )}

          {adopted && (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Looked after by {c!.name}</h2>
              <p className="small">{ADOPTERS[c!.kind ?? ""] ?? ""} · Letter goes to {AGENCIES[c!.agency ?? "unsure"]?.label}, copy to the Wetland Authority of Delhi</p>
              {newKey && (
                <p className="notice info small">
                  Your key: <code>{newKey}</code>. It&rsquo;s saved in this browser. Copy it somewhere safe to update this pond from another phone or computer.
                </p>
              )}
              <div className="pond-actions">
                <button className="button" onClick={() => download(`letter-pond-${p.id}.txt`, "text/plain", agencyLetter(p, summary, who, caseUrl))}>
                  Get the letter to the agency
                </button>
                <button className="button secondary" onClick={() => download(`csr-proposal-pond-${p.id}.txt`, "text/plain", csrProposal(p, summary, who, caseUrl))}>
                  Get the CSR proposal for a company
                </button>
              </div>

              {key && next && (
                <div className="next-step">
                  <p><strong>Next:</strong> {STAGE_WORDS[c!.stage!].next}.</p>
                  <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
                    placeholder={next === "sent" ? "e.g. Sent by speed post, receipt no. EM123456789IN" : "What happened? (optional)"} />
                  <button className="button" onClick={advance} disabled={!!busy}>
                    {busy === "stage" ? "Saving…" : `Mark: ${STAGE_WORDS[next].label}`}
                  </button>
                </div>
              )}
              {!key && (
                <details className="small">
                  <summary>Are you {c!.name}? Enter your key to update this pond</summary>
                  <div className="next-step">
                    <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Your key" />
                    <button className="button secondary" onClick={() => { saveKey(p.id, pasted.trim()); setKey(pasted.trim()); }}>Use this key</button>
                  </div>
                </details>
              )}
            </section>
          )}

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Is there water now?</h2>
            <p className="small">
              Ask the satellite. It reads every clear Sentinel-2 photo of this pond from the last 75 days. Anyone can
              ask, so no one has to take a group&rsquo;s or an agency&rsquo;s word for it.
            </p>
            <button className="button secondary" onClick={look} disabled={!!busy || c?.check_status === "running"}>
              {c?.check_status === "running" ? "Looking from space… (about a minute)" : "Look from space now"}
            </button>
            {latest && (
              <div className={`space-result ${latest.verdict}`}>
                <strong>{SPACE_WORDS[latest.verdict]}</strong>
                {latest.wet_share !== undefined && <span> · water over {Math.round(latest.wet_share * 100)}% of the pond</span>}
                <p className="small muted">
                  {latest.clear_passes ?? 0} clear photo{latest.clear_passes === 1 ? "" : "s"} between {when(latest.window[0])} and {when(latest.window[1])}
                  {latest.latest_clear ? `; the latest clear one was taken on ${when(latest.latest_clear)}` : ""}. Checked {when(latest.checked)}.
                </p>
              </div>
            )}
            {c?.check_status === "error" && <p className="notice error small">The satellite check failed. Please try again later.</p>}
          </section>

          {!lost && (
            <Guide size={48} interactive={false} mood="happy">
              {p.status === "came_back" ? "Good news. If you know who brought this water back, tell them Delhi noticed." : "This pond is still alive. Keep it that way: watch for dumping and building on its edges."}
            </Guide>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PondPage() {
  return (
    <Suspense fallback={<main><Loader label="Loading the pond" /></main>}>
      <PondView />
    </Suspense>
  );
}
