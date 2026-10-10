"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guide, Loader } from "@/components/Mascot";
import { type LakeSummary, loadIndex } from "@/lib/data";
import { loadInsights, type Priority, rankLakes, WEIGHTS } from "@/lib/insights";

const ICON: Record<string, string> = { lost: "▲", share: "▲", recent: "●", hotter: "☀", cooler: "❄", flood: "≈", confirmed: "✓", dropped: "–" };

export default function PriorityPage() {
  const [rows, setRows] = useState<Priority[] | null>(null);
  useEffect(() => {
    Promise.all([loadIndex().then((i) => i.lakes).catch(() => [] as LakeSummary[]), loadInsights()])
      .then(([lakes, insights]) => setRows(rankLakes(lakes, insights)));
  }, []);

  if (!rows) return <main><Loader label="Weighing every lake…" /></main>;
  const top = rows[0];

  return (
    <main className="priority-page">
      <Link href="/lakes/" className="small" style={{ textDecoration: "none" }}>← All lakes</Link>
      <div style={{ maxWidth: 780, margin: "14px 0 24px" }} data-jal-mood="thinking"
        data-jal={`If you can only help one lake, start at the top. ${top ? `${top.name} is first: ` + top.reasons.slice(0, 2).map((r) => r.text.toLowerCase()).join(", and ") + "." : ""}`}>
        <span className="eyebrow">Which lakes to save first</span>
        <h1 style={{ margin: "4px 0 10px" }}>Where help matters most right now</h1>
        <p className="lede">
          For city agencies choosing which lakes to revive, and for companies and groups looking for a lake to adopt.
          Each lake is ranked on what the satellites measured: how much of it turned into land, whether that is still
          happening, how much hotter the filled ground got, and how close the floods came.
        </p>
      </div>

      <ol className="priority-list">
        {rows.map((r) => (
          <li key={r.id} className={r.rank <= 3 ? "top" : undefined}>
            <span className="priority-rank" aria-label={`Rank ${r.rank}`}>{r.rank}</span>
            {r.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="priority-thumb" src={r.thumb} crossOrigin="anonymous" alt="" loading="lazy" />
            ) : <span className="priority-thumb" />}
            <div className="priority-body">
              <Link href={`/lake/${r.id}/`} className="priority-name">{r.name}</Link>
              <span className="small muted">{[r.city, r.state].filter(Boolean).join(", ")}</span>
              {r.reasons.length ? (
                <ul className="priority-reasons">
                  {r.reasons.map((x) => <li key={x.key} className={`why-${x.key}`}><i aria-hidden="true">{ICON[x.key]}</i>{x.text}</li>)}
                </ul>
              ) : <p className="small muted" style={{ margin: "6px 0 0" }}>Nothing turned into land here since 2019.</p>}
              {r.note && <p className="priority-note"><strong>Read this first:</strong> {r.note}</p>}
            </div>
            <span className="priority-score" title="Out of 100">{r.score}</span>
          </li>
        ))}
      </ol>

      <section className="section" style={{ maxWidth: 780 }} data-jal-mood="cautious"
        data-jal="This list is a starting point for deciding where to look first, not an official priority list. Every reason comes straight from the satellite numbers on each lake's page.">
        <h2>How the ranking works</h2>
        <p>
          Each lake gets a share of points for each reason, by where it falls among all the lakes we track: acres turned
          into land, leaving out any flag that didn&apos;t hold up when we compared it with sharper photos (weight {WEIGHTS.lost}), the share of the lake lost ({WEIGHTS.share}), new land in the latest
          summers ({WEIGHTS.recent}), heat at stake, meaning how much hotter the filled bed got and how much cooler the
          ground near the water is ({WEIGHTS.heat}), and flooding within 1 km in the radar flood maps we have
          ({WEIGHTS.flood}). The score is out of 100.
        </p>
        <Guide size={52} tone="info" className="section-guide" interactive={false}>
          It&apos;s a starting point, not an official list. A lake lower down can still matter a lot to the people who live
          beside it, and every reason needs checking on the ground.
        </Guide>
      </section>
    </main>
  );
}
