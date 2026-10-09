"use client";

import { useEffect, useState } from "react";

// One shapes file per state, fetched once and shared by every card from that state.
const cache = new Map<string, Promise<Record<string, string>>>();

function shapesFor(state: string) {
  if (!cache.has(state)) {
    cache.set(
      state,
      fetch(`/catalog/shapes/${state}.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    );
  }
  return cache.get(state)!;
}

/** The lake's real outline (OpenStreetMap), drawn as a silhouette. */
export default function LakeShape({ id, state, label }: { id: string; state: string; label: string }) {
  const [d, setD] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    shapesFor(state).then((s) => live && setD(s[id] ?? ""));
    return () => {
      live = false;
    };
  }, [id, state]);

  return (
    <svg viewBox="-8 -8 116 116" role="img" aria-label={`Outline of ${label}`}
      className="lake-shape">
      {d ? (
        <path d={d} fill="#2f6fd6" fillOpacity="0.85" fillRule="evenodd" stroke="#1d4fa8" strokeWidth="0.6"
          vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
}
