"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/Mascot";
import { API_URL } from "@/lib/data";
import { type Watched, readWatchlist, removeWatched } from "@/lib/watchlist";

export default function Watchlist() {
  const [items, setItems] = useState<Watched[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => setItems(readWatchlist()), []);

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
      <span className="eyebrow">Watchlist</span>
      <h1>Lakes you watch</h1>
      <p className="lede" style={{ maxWidth: 720 }}>
        JalRekha re-checks every analysed lake on the 5th of each month. When a newly processed dry season brings a new
        change flag, everyone watching that lake gets one email.
      </p>

      <ol className="small" style={{ color: "var(--body)", maxWidth: 720, lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Open an analysed lake and enter your email under &ldquo;Watch this lake&rdquo;.</li>
        <li>Confirm the subscription from the AWS Notifications email (alerts only start after you confirm).</li>
        <li>Each alert names the lake, the season and the flagged area. Re-scans of the same season never repeat it.</li>
      </ol>

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
