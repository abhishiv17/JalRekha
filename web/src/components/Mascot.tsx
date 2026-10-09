"use client";

// "Jal", the lake guardian: a chibi Indian freshwater pond turtle, head and shoulders,
// whose shell carries lake-contour lines. The eyes follow the cursor and it blinks
// when poked (both off under reduced motion). Jal is the logo and a quiet guide at each
// step (see Guide); it stays out of the printed evidence report.

import { useEffect, useId, useRef, useState } from "react";

const INK = "#24302a";

type BustProps = { look: { x: number; y: number }; blink: boolean };

function Bust({ look, blink }: BustProps) {
  const clip = useId();
  const eye = (cx: number) =>
    blink ? (
      <path d={`M${cx - 7} 59 q7 4 14 0`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    ) : (
      <g>
        <ellipse cx={cx} cy={58} rx={7.6} ry={8.8} fill="#1d2420" />
        <g transform={`translate(${look.x} ${look.y})`}>
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
      <path d="M55 70q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type Props = { size?: number; title?: string; className?: string; interactive?: boolean };

/** Jal. Decorative unless a title is given; interactive by default. */
export default function Jal({ size = 120, title, className, interactive = true }: Props) {
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
      <Bust look={look} blink={blink} />
    </svg>
  );
}

/** Static compact Jal for small spots (loader). */
export function JalIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <Bust look={{ x: 0, y: 0 }} blink={false} />
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
export function Guide({ children, size = 52, interactive = true, className, tone }: {
  children: React.ReactNode;
  size?: number;
  interactive?: boolean;
  className?: string;
  tone?: "info" | "warn";
}) {
  const text = typeof children === "string" ? children : undefined;
  return (
    <div className={`guide${tone ? ` guide-${tone}` : ""}${className ? ` ${className}` : ""}`}>
      <Jal size={size} interactive={interactive} />
      <div className="guide-bubble" role="status" aria-live="polite" key={text}>
        <span className="sr-only">Jal says: </span>
        {children}
      </div>
    </div>
  );
}
