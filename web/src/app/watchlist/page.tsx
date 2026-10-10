"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, Guide } from "@/components/Mascot";
import { API_URL } from "@/lib/data";
import { type Watched, readWatchlist, removeWatched } from "@/lib/watchlist";

export default function Watchlist() {
  const [items, setItems] = useState<Watched[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    setItems(readWatchlist());
  }, []);

  async function unwatch(w: Watched) {
    if (!API_URL) return;
    setBusy(w.lake + w.email);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/unwatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake: w.lake, email: w.email }),
      });
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      removeWatched(w.lake, w.email);
      setItems(readWatchlist());
      setMessage({ text: `Stopped watching ${w.name}. No more alerts for it will go to ${w.email}.` });
    } catch (e) {
      setMessage({ text: `Could not stop watching ${w.name}: ${e instanceof Error ? e.message : "network error"}.`, error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <div className="ripples" style={{ display: "grid", gap: 12, maxWidth: 760 }}>
        <span className="kicker">My alerts</span>
        <h1 style={{ margin: 0 }}>We&apos;ll keep an eye on it for you.</h1>
        <p className="lede">
          On the 5th of every month we look at every lake again. If a new summer shows more of your lake turning to land,
          you get one short email with where, how much and since when. No newsletters, no repeats.
        </p>
      </div>

      <ol className="acts" style={{ listStyle: "none", padding: 0, margin: "28px 0" }}>
        <li className="act"><h3>Pick your lake</h3><p>Open its page and type your email under &ldquo;Alert me&rdquo;.</p></li>
        <li className="act"><h3>Confirm once</h3><p>Click the link in the email from AWS Notifications. Alerts start only after you confirm.</p></li>
        <li className="act"><h3>Hear only what&apos;s new</h3><p>Each alert names the lake, the summer and the area. The same change is never sent twice.</p></li>
      </ol>

      {items && items.length > 0 && (
        <Guide size={52} className="section-guide" interactive={false}>
          {`I'm watching ${items.length === 1 ? items[0].name : `${items.length} lakes`} for you from this browser. If a new summer brings new change, you'll hear from me once, not every month.`}
        </Guide>
      )}

      {!API_URL && <p className="notice">Alerts are unavailable in this build: no alerts API is configured.</p>}
      {message && <p className={`notice ${message.error ? "error" : "info"}`} role="status">{message.text}</p>}

      {items === null ? null : items.length === 0 ? (
        <EmptyState title="You aren't watching any lakes from this browser">
          <p>Watch a lake from its page to get an email when new change appears.</p>
          <Link className="button" href="/lakes/?status=changed" style={{ marginTop: 8 }}>Find a lake to watch</Link>
        </EmptyState>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="table-scroll"><table>
            <thead><tr><th>Lake</th><th>Email</th><th>Since</th><th /></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.lake + w.email}>
                  <td><Link href={`/lake/${w.lake}/`}>{w.name}</Link></td>
                  <td>{w.email}</td>
                  <td>{w.since}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="secondary" disabled={!API_URL || busy === w.lake + w.email} onClick={() => unwatch(w)}>
                      {busy === w.lake + w.email ? "Removing…" : "Stop watching"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            This list is kept in this browser. Every alert email also has its own unsubscribe link.
          </p>
        </div>
      )}
    </main>
  );
}
