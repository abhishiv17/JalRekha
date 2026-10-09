"use client";

// "Jal", the lake guardian: a chibi Indian freshwater pond turtle, head and shoulders,
// whose shell carries lake-contour lines. The eyes follow the cursor and it blinks
// when poked (both off under reduced motion). Jal is the logo and a quiet guide at each
// step (see Guide); it stays out of the printed evidence report.
//
// Moods match what Jal is doing or has found: happy (default), scanning (a satellite
// circles its head while it reads imagery), thinking (dots rise while it works things
// out), cautious (one brow up: "watch"), worried (sweat drop: high risk) and
// celebrate (closed happy eyes and sparkles: low risk).

import { useEffect, useId, useRef, useState } from "react";

const INK = "#24302a";

export type Mood = "happy" | "scanning" | "thinking" | "cautious" | "worried" | "celebrate";

type BustProps = { look: { x: number; y: number }; blink: boolean; mood?: Mood };

function Bust({ look, blink, mood = "happy" }: BustProps) {
  const clip = useId();
  // Where the eyes look by mood (the cursor wins when it moves).
  const gaze = mood === "thinking" ? { x: 1.8, y: -2 } : mood === "scanning" ? { x: -1.6, y: -1.6 } : { x: 0, y: 0 };
  const eyeLook = look.x || look.y ? look : gaze;
  const eye = (cx: number) =>
    mood === "celebrate" ? (
      <path d={`M${cx - 7} 61 q7 -9 14 0`} fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
    ) : blink ? (
      <path d={`M${cx - 7} 59 q7 4 14 0`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    ) : (
      <g>
        <ellipse cx={cx} cy={58} rx={7.6} ry={8.8} fill="#1d2420" />
        <g transform={`translate(${eyeLook.x} ${eyeLook.y})`}>
          <circle cx={cx - 2.4} cy={54.6} r={2.8} fill="#fff" />
          <circle cx={cx + 2.6} cy={61.2} r={1.3} fill="#fff" />
        </g>
      </g>
    );
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d="M14 120C14 93 34 79 60 79s46 14 46 41Z" />
        </clipPath>
      </defs>
      {/* soft ground shadow */}
      <ellipse cx="60" cy="117" rx="44" ry="5" fill="#000" opacity="0.06" />
      {/* shell on the shoulders, with lake contours */}
      <path d="M14 120C14 93 34 79 60 79s46 14 46 41Z" fill="var(--brand)" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`} fill="none" stroke="var(--sage)" strokeWidth="2.2">
        <path d="M24 122c0-21 16-33 36-33s36 12 36 33" />
        <path d="M35 122c0-14 11-23 25-23s25 9 25 23" strokeOpacity="0.85" />
        <path d="M46 122c0-8 6-13 14-13s14 5 14 13" strokeOpacity="0.7" />
      </g>
      <rect x="40" y="76" width="40" height="10" rx="5" fill="#5f9e72" stroke={INK} strokeWidth="2.2" />
      {/* head */}
      <path d="M26 56c0-20 15-34 34-34s34 14 34 34c0 17-14 28-34 28S26 73 26 56Z" fill="#7cb98a" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M44 30c4-3 10-4 16-4" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="74" cy="33" rx="4" ry="2.6" fill="#5f9e72" />
      <ellipse cx="81" cy="40" rx="2.6" ry="1.8" fill="#5f9e72" />
      {eye(47)}
      {eye(73)}
      {/* cheeks and smile */}
      <ellipse cx="37" cy="68" rx="5.4" ry="3.2" fill="#f2a196" opacity="0.75" />
      <ellipse cx="83" cy="68" rx="5.4" ry="3.2" fill="#f2a196" opacity="0.75" />
      <Mouth mood={mood} />
      <Brows mood={mood} />
      <Extras mood={mood} />
    </>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" as const };
  switch (mood) {
    case "thinking":
    case "scanning":
      return <ellipse cx="62" cy="72" rx="2.6" ry="2.2" fill={INK} />;
    case "cautious":
      return <path d="M55 72h10" {...line} />;
    case "worried":
      return <path d="M54 73q3 -3 6 0t6 0" {...line} />;
    case "celebrate":
      return <path d="M53 69q7 8 14 0Z" fill="#c4544b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
    default:
      return <path d="M55 70q5 4 10 0" {...line} />;
  }
}

function Brows({ mood }: { mood: Mood }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const };
  if (mood === "worried") return <g {...line}><path d="M40 45l11 3" /><path d="M80 45l-11 3" /></g>;
  if (mood === "cautious") return <g {...line}><path d="M41 47h11" /><path d="M68 44q6 -4 12 0" /></g>;
  if (mood === "thinking") return <g {...line}><path d="M41 46q6 -3 11 0" /><path d="M68 44q6 -3 11 1" /></g>;
  return null;
}

function Extras({ mood }: { mood: Mood }) {
  if (mood === "scanning") {
    // A small satellite sweeping over the head, like a scanner.
    return (
      <g className="jal-orbit">
        <g transform="translate(60 52)">
          <g transform="translate(0 -46)">
            <rect x="-4" y="-3" width="8" height="6" rx="1.5" fill="#d9dfe6" stroke={INK} strokeWidth="1.6" />
            <rect x="-13" y="-2.5" width="8" height="5" fill="var(--water)" stroke={INK} strokeWidth="1.2" />
            <rect x="5" y="-2.5" width="8" height="5" fill="var(--water)" stroke={INK} strokeWidth="1.2" />
          </g>
        </g>
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g className="jal-dots" fill="var(--brand-soft)">
        <circle cx="94" cy="22" r="3" />
        <circle cx="102" cy="13" r="4" />
        <circle cx="112" cy="5" r="5" />
      </g>
    );
  }
  if (mood === "worried") {
    return <path className="jal-drop" d="M92 34c3 5 5 8 5 10a5 5 0 0 1-10 0c0-2 2-5 5-10Z" fill="#8cc8f0" stroke={INK} strokeWidth="1.6" />;
  }
  if (mood === "celebrate") {
    const star = (x: number, y: number, r: number) =>
      `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`;
    return (
      <g className="jal-sparkle" fill="#f5c542" stroke={INK} strokeWidth="1.2">
        <path d={star(16, 26, 7)} />
        <path d={star(104, 18, 6)} />
        <path d={star(108, 62, 4)} />
      </g>
    );
  }
  return null;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type Props = { size?: number; title?: string; className?: string; interactive?: boolean; mood?: Mood };

/** Jal. Decorative unless a title is given; interactive by default. */
export default function Jal({ size = 120, title, className, interactive = true, mood = "happy" }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!interactive || prefersReducedMotion()) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.45);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 300);
        setLook({ x: (dx / d) * 2.2 * k, y: (dy / d) * 2.2 * k });
      });
    };
    window.addEventListener("pointermove", onMove);
    // An occasional idle blink.
    const idle = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 5200);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(idle);
      cancelAnimationFrame(frame);
    };
  }, [interactive]);

  const poke = () => {
    if (!interactive || prefersReducedMotion()) return;
    setBlink(true);
    window.setTimeout(() => setBlink(false), 180);
  };

  return (
    <svg ref={ref} width={size} height={size} viewBox="0 0 120 120" className={className} onClick={poke}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={interactive ? { cursor: "pointer" } : undefined}>
      <Bust look={look} blink={blink} mood={mood} />
    </svg>
  );
}

/** Static compact Jal for small spots (loader). */
export function JalIcon({ size = 40, className, mood }: { size?: number; className?: string; mood?: Mood }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <Bust look={{ x: 0, y: 0 }} blink={false} mood={mood} />
    </svg>
  );
}

/** Loading indicator: Jal bobbing gently (still under reduced motion). */
export function Loader({ label }: { label: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <JalIcon size={44} className="bob" />
      <span>{label}</span>
    </div>
  );
}

/** Empty or unavailable state: Jal plus the real explanation. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <Jal size={104} />
      <h3 style={{ margin: "8px 0 6px" }}>{title}</h3>
      <div className="muted" style={{ maxWidth: 520, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

/**
 * Jal speaking: the mascot beside a speech bubble. Used as a quiet narrator at each
 * step; everything it says is computed from the data on screen. The bubble re-animates
 * when its text changes (key), and is announced politely to screen readers.
 */
export function Guide({ children, size = 52, interactive = true, className, tone, mood }: {
  children: React.ReactNode;
  size?: number;
  interactive?: boolean;
  className?: string;
  tone?: "info" | "warn";
  mood?: Mood;
}) {
  const text = typeof children === "string" ? children : undefined;
  return (
    <div className={`guide${tone ? ` guide-${tone}` : ""}${className ? ` ${className}` : ""}`}>
      <Jal size={size} interactive={interactive} mood={mood ?? (tone === "warn" ? "cautious" : "happy")} />
      <div className="guide-bubble" role="status" aria-live="polite" key={text}>
        <span className="sr-only">Jal says: </span>
        {children}
      </div>
    </div>
  );
}
