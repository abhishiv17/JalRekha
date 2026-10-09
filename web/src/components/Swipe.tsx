"use client";

import { type ReactNode, useState } from "react";

/** Before/after comparison over the same extent: drag (or use arrow keys) to reveal the later image. */
export default function Swipe({ before, after, beforeLabel, afterLabel, overlay }: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  overlay?: ReactNode; // drawn over both images (lake outline, flags)
}) {
  const [pos, setPos] = useState(50);
  const [missing, setMissing] = useState<string | null>(null);
  return (
    <div>
      <div className="swipe-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={`${beforeLabel}, satellite true colour`} onError={() => setMissing(beforeLabel)} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt={`${afterLabel}, satellite true colour`}
          onError={() => setMissing(afterLabel)}
          style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${pos}%)` }}
        />
        {overlay}
        <div aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 3, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.25)", zIndex: 2 }} />
        <span className="label swipe-tag before" style={{ left: 10 }}>BEFORE · {beforeLabel.toUpperCase()}</span>
        <span className="label swipe-tag after" style={{ right: 10 }}>AFTER · {afterLabel.toUpperCase()}</span>
      </div>
      {missing && <p className="notice error">The image for {missing} could not be loaded.</p>}
      <input
        className="slider"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Swipe between ${beforeLabel} and ${afterLabel}`}
        aria-valuetext={`${pos}% showing ${afterLabel}`}
      />
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>← {beforeLabel}</span>
        <span>{afterLabel} →</span>
      </div>
    </div>
  );
}
