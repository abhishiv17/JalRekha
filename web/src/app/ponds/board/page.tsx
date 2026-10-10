"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CaseBadge from "@/components/CaseBadge";
import { EmptyState, Loader } from "@/components/Mascot";
import { AGENCIES, ADOPTERS, STAGES, STAGE_WORDS, getCases, type PondCase } from "@/lib/ponds";
import { PLOT_API_URL } from "@/lib/plot";

type Row = { agency: string; sent: number; answered: number; overdue: number; working: number; revived: number; waits: number[] };

const reached = (c: PondCase, s: (typeof STAGES)[number]) => !!c.stage && STAGES.indexOf(c.stage) >= STAGES.indexOf(s);

export default function Board() {
  const [cases, setCases] = useState<PondCase[] | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCases().then((r) => { setCases(r.cases); setDays(r.answer_days); }).catch((e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    const by: Record<string, Row> = {};
    for (const c of cases ?? []) {
      if (!reached(c, "sent")) continue;
      const r = (by[c.agency ?? "unsure"] ??= { agency: c.agency ?? "unsure", sent: 0, answered: 0, overdue: 0, working: 0, revived: 0, waits: [] });
      r.sent++;
      if (reached(c, "answered")) r.answered++;
      if (c.overdue) r.overdue++;
      if (reached(c, "work_started")) r.working++;
      if (c.revived) r.revived++;
      const sent = c.history.find((h) => h.stage === "sent")?.at;
      const answered = c.history.find((h) => h.stage === "answered")?.at;
      if (sent && answered) r.waits.push(Math.round((+new Date(answered) - +new Date(sent)) / 86400000));
    }
    return Object.values(by).sort((a, b) => b.overdue - a.overdue || b.sent - a.sent);
  }, [cases]);

  const totals = useMemo(() => {
    const all = cases ?? [];
    return {
      adopted: all.length,
      sent: all.filter((c) => reached(c, "sent")).length,
      overdue: all.filter((c) => c.overdue).length,
      revived: all.filter((c) => c.revived).length,
      flagged: all.filter((c) => c.claim_not_seen).length,
    };
  }, [cases]);

  return (
    <main>
      <Link href="/ponds/" className="small">&larr; All of Delhi&rsquo;s ponds</Link>
      <span className="eyebrow" style={{ display: "block", marginTop: 12 }}>Public clock</span>
      <h1>Who is bringing Delhi&rsquo;s ponds back, and who is keeping them waiting</h1>
      <p className="lede" style={{ maxWidth: 760 }}>
        Every adopted pond, the agency that owns its land, and how long that agency has taken to answer. An agency has
        {` ${days} `}days to answer a letter before it shows as overdue. Groups report each step; the satellite checks the
        water for itself.
      </p>

      {!PLOT_API_URL && <p className="notice">Cases are unavailable in this build: no API is configured.</p>}
      {error && <p className="notice error">Could not load the cases: {error}</p>}
      {!cases && !error && PLOT_API_URL && <Loader label="Loading the cases" />}

      {cases && (
        <>
          <dl className="stat-tiles">
            <div className="stat-tile"><dt>PONDS ADOPTED</dt><dd>{totals.adopted}</dd><small>By local groups</small></div>
            <div className="stat-tile"><dt>LETTERS SENT</dt><dd>{totals.sent}</dd><small>To land-owning agencies</small></div>
            <div className="stat-tile"><dt>OVERDUE</dt><dd className="changed">{totals.overdue}</dd><small>No answer in {days} days</small></div>
            <div className="stat-tile"><dt>REVIVED</dt><dd className="win">{totals.revived}</dd><small>Water seen from space</small></div>
          </dl>

          {totals.flagged > 0 && (
            <p className="notice error">
              {totals.flagged} pond{totals.flagged === 1 ? " is" : "s are"} reported as having water back, but the latest
              clear satellite photo shows none. They are marked below.
            </p>
          )}

          <h2>Agencies</h2>
          {rows.length === 0 ? (
            <p className="small muted">No letters have been marked as sent yet. When a group sends one, the agency appears here with its clock.</p>
          ) : (
            <div className="table-wrap">
              <table className="board-table">
                <thead>
                  <tr><th>Agency</th><th>Letters</th><th>Answered</th><th>Overdue</th><th>Work started</th><th>Revived</th><th>Typical days to answer</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.agency}>
                      <td>{AGENCIES[r.agency]?.label ?? r.agency}</td>
                      <td>{r.sent}</td>
                      <td>{r.answered}</td>
                      <td className={r.overdue ? "overdue" : ""}>{r.overdue}</td>
                      <td>{r.working}</td>
                      <td className={r.revived ? "win" : ""}>{r.revived}</td>
                      <td>{r.waits.length ? r.waits.sort((a, b) => a - b)[Math.floor(r.waits.length / 2)] : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Every adopted pond</h2>
          {cases.length === 0 ? (
            <EmptyState title="No pond adopted yet">
              <p>Be the first. <Link href="/ponds/">Pick a dried-up pond near you</Link> and adopt it.</p>
            </EmptyState>
          ) : (
            <ol className="case-list">
              {[...cases].sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || (b.created ?? "").localeCompare(a.created ?? "")).map((c) => (
                <li key={c.pond_id} className="card">
                  <Link href={`/ponds/pond/?id=${c.pond_id}`}><strong>Pond {c.pond_id}</strong></Link>
                  <span className="small muted">{c.district ? ` · ${c.district}` : ""}</span>
                  <p className="small">
                    {c.name} ({ADOPTERS[c.kind ?? ""] ?? "group"}) · {AGENCIES[c.agency ?? "unsure"]?.label}
                  </p>
                  <div className="stage-strip" aria-label={`Stage: ${c.stage ? STAGE_WORDS[c.stage].label : ""}`}>
                    {STAGES.map((s) => <span key={s} className={reached(c, s) ? "on" : ""} title={STAGE_WORDS[s].label} />)}
                    <span className={c.revived ? "on revived" : ""} title="Revived: water seen from space" />
                  </div>
                  <CaseBadge c={c} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}
