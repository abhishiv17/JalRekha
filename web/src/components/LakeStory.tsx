"use client";

// A scroll-driven walkthrough of one lake: the stage stays pinned while six short steps
// scroll past, and each step adds one layer to the real satellite photo. The lake's edge
// draws itself, a satellite sweeps from the first year to the latest, open water floods
// in, the spots that became land pulse, the 30-metre zone rings the lake, and a final
// card slides up. Used on the home page (Bhalswa) and on every lake page; shapes come
// from the pipeline's real results. Motion is off under prefers-reduced-motion.

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { JalIcon, type Mood } from "@/components/Mascot";

export type StoryData = {
  w: number;
  h: number;
  before: string; // photo URLs
  after: string;
  beforeYear: number;
  afterYear: number;
  outline: string; // SVG path data in a w x h box
  zone: string;
  water: string;
  spots: string[];
  callout?: { text: ReactNode; x: number; y: number } | null; // x, y in % of the stage
};
export type StoryStep = { title: string; text: string; mood: Mood; chip: string };
export type StoryEnd = { title: string; text: string; href: string; label: string; mood?: Mood };

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function LakeStory({ data, steps, end, label, compact = false, mode = "scroll" }: {
  data: StoryData;
  steps: StoryStep[];
  end: StoryEnd;
  label: string;
  compact?: boolean;
  // "scroll": steps advance as the page scrolls (home page). "stepper": arrow buttons (lake pages).
  mode?: "scroll" | "stepper";
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const stepper = mode === "stepper";
  const move = (to: number) => {
    const n = Math.max(0, Math.min(steps.length - 1, to));
    setDir(n >= step ? "next" : "prev");
    setStep(n);
  };
  const [year, setYear] = useState(data.beforeYear);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  // The step in the middle of the screen is the active one (scroll mode only).
  useEffect(() => {
    if (stepper) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length, stepper]);

  // Step 2: the year counter runs with the satellite sweep.
  useEffect(() => {
    if (step < 1) return setYear(data.beforeYear);
    if (step > 1 || reducedMotion()) return setYear(data.afterYear);
    setYear(data.beforeYear);
    let y = data.beforeYear;
    const t = window.setInterval(() => {
      y += 1;
      setYear(y);
      if (y >= data.afterYear) window.clearInterval(t);
    }, Math.max(150, 1800 / Math.max(1, data.afterYear - data.beforeYear)));
    return () => window.clearInterval(t);
  }, [step, data.beforeYear, data.afterYear]);

  const at = (n: number) => (step >= n ? " on" : "");
  const go = (n: number) =>
    stepper ? move(n) : refs.current[n]?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
  const box = `0 0 ${data.w} ${data.h}`;

  return (
    <div className={`story${compact ? " story-compact" : ""}${stepper ? " story-stepper" : ""}`}
      onKeyDown={stepper ? (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); move(step + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); move(step - 1); }
      } : undefined}>
      <div className="story-stage-wrap">
        <figure className="story-stage" style={{ aspectRatio: `${data.w} / ${data.h}` }} aria-label={label}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="story-img" src={data.before} crossOrigin="anonymous" alt={`${label}, ${data.beforeYear}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`story-img story-2026${at(1)}`} src={data.after} crossOrigin="anonymous" alt={`${label}, ${data.afterYear}`} />
          <div className={`story-layer story-water${at(2)}`}>
            <svg viewBox={box} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <path d={data.water} fill="#1e78dc" fillOpacity="0.72" fillRule="evenodd" stroke="#9fd0ff" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </div>
          <svg className={`story-layer story-zone${at(4)}`} viewBox={box} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path d={data.zone} fill="#ffd54f" fillOpacity="0.5" fillRule="evenodd" stroke="#ffe082" strokeWidth="2" strokeDasharray="6 5" />
          </svg>
          <svg className="story-layer" viewBox={box} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path className={`story-outline${at(0)}`} d={data.outline} pathLength={1} fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
          </svg>
          <svg className={`story-layer story-spots${at(3)}`} viewBox={box} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {data.spots.map((d, i) => (
              <g key={i}>
                <path className="story-spot-pulse" d={d} fill="none" stroke="#f5a524" strokeWidth="6" />
                <path d={d} fill="#f5a524" fillOpacity="0.45" stroke="#f5a524" strokeWidth="3" strokeLinejoin="round" />
              </g>
            ))}
          </svg>
          <div className={`story-scan${step === 1 ? " run" : ""}`} aria-hidden="true">
            <svg className="story-sat" viewBox="-14 -8 28 16" width="44" height="26">
              <rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="#e6ebf0" stroke="#24302a" strokeWidth="1.3" />
              <rect x="-13" y="-3" width="8" height="6" fill="#1e78dc" stroke="#24302a" strokeWidth="1" />
              <rect x="5" y="-3" width="8" height="6" fill="#1e78dc" stroke="#24302a" strokeWidth="1" />
            </svg>
          </div>

          <div className="story-chip" aria-live="polite">
            <span className="story-year">{year}</span>
            <span>{steps[step].chip}</span>
          </div>
          {data.callout && (
            <div className={`story-callout${at(3)}`}
              style={{ left: `${Math.min(70, Math.max(4, data.callout.x + 4))}%`, top: `${Math.min(78, Math.max(14, data.callout.y - 12))}%`, right: "auto" }}>
              {data.callout.text}
            </div>
          )}
          <div className={`story-proof${at(5)}`}>
            <JalIcon size={40} mood={end.mood ?? "celebrate"} />
            <div>
              <b>{end.title}</b>
              <span>{end.text}</span>
            </div>
            <Link className="button" href={end.href}>{end.label}</Link>
          </div>

          <ol className="story-dots" aria-label="Steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <button type="button" aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? "step" : undefined}
                  className={i <= step ? "done" : undefined} onClick={() => go(i)} />
              </li>
            ))}
          </ol>
        </figure>
      </div>

      {stepper ? (
        <div className="story-panel">
          <div className={`story-step-card story-panel-card ${dir}`} key={step} aria-live="polite">
            <span className="story-num">{step + 1}</span>
            <div>
              <h3>{steps[step].title}</h3>
              <p>{steps[step].text}</p>
            </div>
            <JalIcon size={52} mood={steps[step].mood} className="story-jal" />
          </div>
          <div className="story-nav" role="group" aria-label="Move through the steps">
            <button type="button" className="story-arrow" onClick={() => move(step - 1)} disabled={step === 0} aria-label="Previous step">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="story-progress">
              <span className="small">Step {step + 1} of {steps.length}</span>
              <div className="story-progress-dots">
                {steps.map((s, i) => (
                  <button key={s.title} type="button" aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? "step" : undefined}
                    className={i <= step ? "done" : undefined} onClick={() => move(i)} />
                ))}
              </div>
            </div>
            <button type="button" className="story-arrow next" onClick={() => move(step + 1)} disabled={step === steps.length - 1} aria-label="Next step">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Tip: you can also use the left and right arrow keys.</p>
        </div>
      ) : (
      <div className="story-steps">
        {steps.map((s, i) => (
          <div key={s.title} ref={(el) => { refs.current[i] = el; }} data-step={i}
            className={`story-step${i === step ? " active" : ""}`}>
            <div className="story-step-card">
              <span className="story-num">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
              <JalIcon size={46} mood={s.mood} className="story-jal" />
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

// --- Home page: Bhalswa Lake, from prepared files (public/story/) -------------------

type BhalswaFile = { w: number; h: number; outline: string; zone: string; water2026: string; spots: { d: string }[]; lostAcres: number };

const BHALSWA_STEPS: StoryStep[] = [
  { title: "Start with a real lake", mood: "happy", chip: "Satellite photo · Jan–Apr 2019",
    text: "This is Bhalswa Lake in north Delhi, seen from space in 2019. The white line is the edge of the lake." },
  { title: "Look at it every year", mood: "scanning", chip: "Satellite photo · Jan–Apr 2026",
    text: "Satellites photograph it every few days. We compare the same months each year, 2019 to 2026, so a dry summer can't fool us." },
  { title: "Find the water", mood: "thinking", chip: "Open water in blue",
    text: "Blue is open water. Green patches inside the white line are weeds floating on water, so they still count as lake." },
  { title: "Spot where the lake became land", mood: "worried", chip: "Lake turned to land in orange",
    text: "Orange is where the satellite saw lake bed turn into land. Sharper photos confirm soil pushed in along the south-east shore. Some of the orange is water under green algae, so it is a lead to check, not a verdict." },
  { title: "Check the no-build zone", mood: "cautious", chip: "30-metre no-build zone",
    text: "The yellow ring is 30 metres around the lake, where nothing should be built. Part of the change sits inside it." },
  { title: "Get proof to act", mood: "celebrate", chip: "Proof ready",
    text: "Download dated photos, map points and a ready letter to the city. Or watch the lake and get an email if it shrinks again." },
];

export function BhalswaStory() {
  const [file, setFile] = useState<BhalswaFile | null>(null);
  useEffect(() => {
    fetch("/story/bhalswa.json").then((r) => r.json()).then(setFile).catch(() => setFile(null));
  }, []);
  if (!file) return <div className="story-placeholder" />;
  const data: StoryData = {
    w: file.w, h: file.h, before: "/story/bhalswa-2019.jpg", after: "/story/bhalswa-2026.jpg",
    beforeYear: 2019, afterYear: 2026, outline: file.outline, zone: file.zone, water: file.water2026,
    spots: file.spots.map((s) => s.d),
    callout: { text: <><b>{file.lostAcres.toFixed(2)} acres</b> flagged</>, x: 66, y: 30 },
  };
  return (
    <LakeStory data={data} steps={BHALSWA_STEPS} label="Bhalswa Lake, Delhi, step by step" mode="scroll"
      end={{ title: "Proof ready", text: "Dated photos · map points · complaint letter · Right to Information request",
        href: "/lake/bhalswa/", label: "Open Bhalswa Lake" }} />
  );
}
