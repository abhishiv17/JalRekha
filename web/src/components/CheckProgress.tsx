"use client";

import { useEffect, useState } from "react";
import Jal, { type Mood } from "@/components/Mascot";
import type { Progress } from "@/lib/plot";

export type ProgressStep = { id: string; label: string; faces: { mood: Mood; say: string }[] };

// Plot Check: what Jal does at each step. Faces and lines rotate while a step runs.
export const PLOT_STEPS: ProgressStep[] = [
  {
    id: "queued", label: "Starting",
    faces: [
      { mood: "happy", say: "Getting ready…" },
      { mood: "wink", say: "Waking up the satellites…" },
      { mood: "curious", say: "Finding your spot on the map…" },
    ],
  },
  {
    id: "read", label: "Reading satellite photos, 2019 to 2026",
    faces: [
      { mood: "scanning", say: "Looking down at your spot from space…" },
      { mood: "searching", say: "Checking every clear photo…" },
      { mood: "surprised", say: "So many photos of one spot!" },
      { mood: "scanning", say: "Same months every year, so seasons can't fool me…" },
    ],
  },
  {
    id: "water", label: "Finding where water has been",
    faces: [
      { mood: "thinking", say: "Was there ever water here?" },
      { mood: "searching", say: "Tracing the lake's edge…" },
      { mood: "curious", say: "How close does the water come?" },
    ],
  },
  {
    id: "flood", label: "Checking flood maps",
    faces: [
      { mood: "thinking", say: "Did this spot flood?" },
      { mood: "cautious", say: "Reading radar flood maps…" },
    ],
  },
  {
    id: "explain", label: "Writing your report",
    faces: [
      { mood: "writing", say: "Putting it in simple words…" },
      { mood: "writing", say: "In English, Kannada, Telugu and Hindi…" },
      { mood: "wink", say: "Almost done!" },
    ],
  },
];

const ROTATE_MS = 2200;

/** Live steps while a job runs: what Jal is doing now, and the latest findings. */
export default function CheckProgress({ progress, since, steps = PLOT_STEPS, usually = "usually under 2 minutes" }: {
  progress?: Progress | { step: string; done: number; total: number; log: string[] };
  since?: string;
  steps?: ProgressStep[];
  usually?: string;
}) {
  const step = progress?.step ?? steps[0].id;
  const at = Math.max(0, steps.findIndex((s) => s.id === step));
  const [seconds, setSeconds] = useState(0);
  const [face, setFace] = useState(0);

  useEffect(() => {
    const start = since ? Date.parse(since) : Date.now();
    const tick = () => setSeconds(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [since]);

  // A new step starts at its first face; then the faces take turns.
  useEffect(() => {
    setFace(0);
    const t = setInterval(() => setFace((f) => f + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [at]);

  const faces = steps[at].faces;
  const now = faces[face % faces.length];
  const log = progress?.log ?? [];
  const pct = progress?.total ? Math.round((100 * progress.done) / progress.total) : 0;

  return (
    <section className="card progress" aria-live="polite">
      <div className="progress-head">
        <div className="progress-jal">
          <div className="progress-pop" key={`${at}-${face}`}>
            <Jal size={92} mood={now.mood} interactive={false} />
          </div>
          <span className="progress-ripple" aria-hidden="true" />
        </div>
        <div>
          <div className="progress-say" key={`say-${at}-${face}`}>{now.say}</div>
          <div className="small muted">{seconds}s · {usually}</div>
        </div>
      </div>

      <ol className="progress-steps">
        {steps.map((s, i) => (
          <li key={s.id} className={i < at ? "done" : i === at ? "now" : "next"}>
            <span className="progress-dot" aria-hidden="true">{i < at ? "✓" : ""}</span>
            <span>
              {s.label}
              {i === at && progress?.total ? ` (${progress.done} of ${progress.total})` : ""}
            </span>
          </li>
        ))}
      </ol>

      {progress?.total ? (
        <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="progress-bar indeterminate" aria-hidden="true"><span /></div>
      )}

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
