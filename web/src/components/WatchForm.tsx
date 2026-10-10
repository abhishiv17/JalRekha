"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Guide } from "@/components/Mascot";
import { API_URL } from "@/lib/data";
import { addWatched } from "@/lib/watchlist";

/**
 * Email subscription for new-change alerts (API Gateway -> Lambda -> DynamoDB + SNS).
 * Without NEXT_PUBLIC_API_URL the form says alerts are unavailable instead of pretending.
 */
export default function WatchForm({ lake, name }: { lake: string; name: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  // "confirm": a new address, AWS sends a confirmation email; "added": already confirmed, this lake joins
  // their alerts; "pending": they haven't confirmed the first email yet.
  const [status, setStatus] = useState<"confirm" | "added" | "pending">("confirm");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!API_URL) return;
    setState("sending");
    try {
      const res = await fetch(`${API_URL}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake, email }),
      });
      if (res.ok) {
        setStatus(((await res.json().catch(() => ({}))) as { status?: "confirm" | "added" | "pending" }).status ?? "confirm");
        addWatched({ lake, name, email: email.trim().toLowerCase(), since: new Date().toISOString().slice(0, 10) });
        setState("done");
      } else {
        setError((await res.json().catch(() => ({}))).error ?? `The server answered ${res.status}.`);
        setState("error");
      }
    } catch {
      setError("The alerts service could not be reached.");
      setState("error");
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="watch-email" className="small"><strong>Watch this lake</strong></label>
      <p className="small muted" style={{ margin: "2px 0 8px" }}>
        Get one email if this lake starts shrinking again (we check every month). You confirm your email first.
      </p>
      <div className="row">
        <input id="watch-email" type="email" required placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 180 }} disabled={!API_URL} />
        <button className="secondary" disabled={!API_URL || state === "sending"}>
          {state === "sending" ? "Subscribing…" : "Watch"}
        </button>
      </div>
      {!API_URL && <p className="small muted" role="status">Alerts are unavailable in this build (no alerts API configured).</p>}
      {state === "done" && (
        <Guide size={44} tone="info" className="watch-guide">
          {status === "added" ? (
            <>Added. <strong>{email}</strong> is already confirmed, so I&apos;ll also write if this lake starts shrinking again.{" "}
            <Link href="/watchlist/">Your watchlist</Link></>
          ) : status === "pending" ? (
            <>Saved. First confirm the email AWS Notifications sent to <strong>{email}</strong>, then press Watch here once more
            so this lake is added to your alerts. <Link href="/watchlist/">Your watchlist</Link></>
          ) : (
            <>I&apos;ll keep watch. Confirm the email AWS Notifications just sent to <strong>{email}</strong>; after that I&apos;ll write
            only if this lake starts shrinking again. <Link href="/watchlist/">Your watchlist</Link></>
          )}
        </Guide>
      )}
      {state === "error" && <p className="small" role="alert" style={{ color: "var(--danger)" }}>Could not subscribe: {error}</p>}
    </form>
  );
}
