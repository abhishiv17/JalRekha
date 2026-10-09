"use client";

import { type FormEvent, useState } from "react";
import { API_URL } from "@/lib/data";

/** Email subscription for monthly alerts; needs NEXT_PUBLIC_API_URL. */
export default function WatchForm({ lake }: { lake: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

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
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 16 }}>
      <label htmlFor="watch-email" className="small"><strong>Watch this lake</strong> · monthly email when a new change appears</label>
      <div className="row" style={{ marginTop: 6 }}>
        <input
          id="watch-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <button className="secondary" disabled={!API_URL || state === "sending"}>Watch</button>
      </div>
      {!API_URL && <p className="small muted">Alerts switch on once the API is deployed.</p>}
      {state === "done" && <p className="small">Check your inbox to confirm the subscription.</p>}
      {state === "error" && <p className="small">Could not subscribe; try again later.</p>}
    </form>
  );
}
