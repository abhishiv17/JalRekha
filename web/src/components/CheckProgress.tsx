"use client";

import { useEffect, useState } from "react";
import Jal, { type Mood } from "@/components/Mascot";
import type { Progress } from "@/lib/plot";

const STEPS: { id: Progress["step"]; label: string; mood: Mood; say: string }[] = [
  { id: "queued", label: "Starting", mood: "happy", say: "Getting ready…" },
  { id: "read", label: "Reading satellite photos, 2019 to 2026", mood: "scanning", say: "Looking down at your spot from space…" },
  { id: "water", label: "Finding where water has been", mood: "thinking", say: "Was there ever water here?" },
  { id: "flood", label: "Checking flood maps", mood: "thinking", say: "Did it flood in 2022?" },
  { id: "explain", label: "Writing your report", mood: "thinking", say: "Putting it in simple words…" },
];

/** Live steps while a Plot Check runs: what Jal is doing now, and the latest findings. */
export default function CheckProgress({ progress, since }: { progress?: Progress; since?: string }) {
  const step = progress?.step ?? "queued";
  const at = Math.max(0, STEPS.findIndex((s) => s.id === step));
  const now = STEPS[at];
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const start = since ? Date.parse(since) : Date.now();
    const tick = () => setSeconds(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [since]);

  const log = progress?.log ?? [];
  const pct = progress?.total ? Math.round((100 * progress.done) / progress.total) : 0;

  return (
    <section className="card progress" aria-live="polite">
      <div className="progress-head">
        <Jal size={88} mood={now.mood} interactive={false} />
        <div>
          <div className="progress-say">{now.say}</div>
          <div className="small muted">{seconds}s · usually under 2 minutes</div>
        </div>
      </div>

      <ol className="progress-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i < at ? "done" : i === at ? "now" : "next"}>
            <span className="progress-dot" aria-hidden="true">{i < at ? "✓" : ""}</span>
            <span>
              {s.label}
              {s.id === "read" && i === at && progress?.total ? ` (${progress.done} of ${progress.total})` : ""}
            </span>
          </li>
        ))}
      </ol>

      {step === "read" && progress?.total ? (
        <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      {log.length > 0 && (
        <ul className="progress-log">
          {log.slice(-6).map((line, i, shown) => (
            <li key={`${log.length - shown.length + i}-${line}`} className={i === shown.length - 1 ? "latest" : undefined}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
