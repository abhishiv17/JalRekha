"use client";

// "Jal", the lake guardian: a chibi Indian freshwater pond turtle, full body: a domed
// shell with scutes (lake contours on the centre one), flippers and a striped head. The eyes follow the cursor and it blinks
// when poked (both off under reduced motion). Jal is the logo and a quiet guide at each
// step (see Guide); it stays out of the printed evidence report.

import { useEffect, useId, useRef, useState } from "react";

const INK = "#24302a";

type BustProps = { look: { x: number; y: number }; blink: boolean };

function Bust({ look, blink }: BustProps) {
  const clip = useId();
  const eye = (cx: number) =>
    blink ? (
      <path d={`M${cx - 5.5} 67 q5.5 3.5 11 0`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    ) : (
      <g>
        <ellipse cx={cx} cy={66} rx={5.6} ry={6.6} fill="#1d2420" />
        <g transform={`translate(${look.x * 0.8} ${look.y * 0.8})`}>
          <circle cx={cx - 1.8} cy={63.4} r={2.1} fill="#fff" />
          <circle cx={cx + 2} cy={68.4} r={1} fill="#fff" />
        </g>
      </g>
    );
  const SKIN = "#8cc49a";
  const SKIN_DARK = "#5f9e72";
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d="M12 92C12 54 34 30 60 30s48 24 48 62Z" />
        </clipPath>
      </defs>
      {/* soft ground shadow */}
      <ellipse cx="60" cy="113" rx="48" ry="5" fill="#000" opacity="0.07" />
      {/* back feet and a tail peeking out */}
      <ellipse cx="17" cy="96" rx="9" ry="6" fill={SKIN} stroke={INK} strokeWidth="2.2" />
      <ellipse cx="103" cy="96" rx="9" ry="6" fill={SKIN} stroke={INK} strokeWidth="2.2" />
      {/* domed shell with scutes; the centre scute carries lake contours */}
      <path d="M12 92C12 54 34 30 60 30s48 24 48 62Z" fill="var(--brand)" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`} fill="none" stroke="#a9d3b4" strokeWidth="2" strokeLinejoin="round">
        <path d="M46 44l14-8 14 8v14l-14 8-14-8Z" />
        <path d="M46 58l-14 6M74 58l14 6M46 44l-12-6M74 44l12-6M60 66v26M32 64l-4 28M88 64l4 28" />
        <path d="M52 51c0-3 4-5 8-5s8 2 8 5-4 5-8 5-8-2-8-5Z" strokeOpacity="0.8" />
      </g>
      <path d="M28 40c6-6 14-9 22-10" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
      {/* shell rim (marginal scutes) */}
      <path d="M10 92h100v4a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6Z" fill="#2f7a52" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M24 92v10M38 92v10M82 92v10M96 92v10" stroke={INK} strokeOpacity="0.45" strokeWidth="1.6" />
      {/* front flippers with claws */}
      <path d="M30 98c-4 6-4 12 2 14 6 1 11-2 12-8" fill={SKIN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M90 98c4 6 4 12-2 14-6 1-11-2-12-8" fill={SKIN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M31 109l-2 3M35 111l-1 3M89 109l2 3M85 111l1 3" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      {/* neck and head, poking out in front of the shell */}
      <path d="M48 96c0-8 5-12 12-12s12 4 12 12" fill={SKIN} stroke={INK} strokeWidth="2.2" />
      <path d="M38 70c0-14 10-22 22-22s22 8 22 22c0 13-10 21-22 21S38 83 38 70Z" fill={SKIN} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      {/* yellow head stripes of an Indian pond turtle, and a couple of spots */}
      <path d="M41 64c3-5 7-8 11-9M79 64c-3-5-7-8-11-9" fill="none" stroke="#f2d46b" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="60" cy="55" r="2.2" fill={SKIN_DARK} />
      <circle cx="54" cy="52" r="1.4" fill={SKIN_DARK} />
      <circle cx="66" cy="52" r="1.4" fill={SKIN_DARK} />
      {eye(51)}
      {eye(69)}
      {/* nostrils, beak smile, cheeks */}
      <circle cx="58" cy="74" r="0.9" fill={INK} />
      <circle cx="62" cy="74" r="0.9" fill={INK} />
      <path d="M53 79q7 5 14 0" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="44" cy="76" rx="4" ry="2.4" fill="#f2a196" opacity="0.7" />
      <ellipse cx="76" cy="76" rx="4" ry="2.4" fill="#f2a196" opacity="0.7" />
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
