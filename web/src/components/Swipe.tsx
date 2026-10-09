"use client";

import { useState } from "react";

/** Before/after comparison: drag to reveal the later image over the earlier one. */
export default function Swipe({ before, after, beforeLabel, afterLabel }: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ position: "relative", width: "100%", lineHeight: 0, borderRadius: 10, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={beforeLabel} style={{ width: "100%", imageRendering: "pixelated" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt={afterLabel}
          style={{
            position: "absolute", inset: 0, width: "100%", imageRendering: "pixelated",
            clipPath: `inset(0 0 0 ${pos}%)`,
          }}
        />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, background: "#fff" }} />
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Swipe between images"
      />
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>← {beforeLabel}</span>
        <span>{afterLabel} →</span>
      </div>
    </div>
  );
}
