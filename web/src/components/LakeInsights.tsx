"use client";

// "What this lake does for you": summer ground temperature around the lake (Landsat) and the
// floods we have mapped near it (Sentinel-1). Facts only; the captions say what they don't prove.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Outlines } from "@/components/OutlinedImage";
import type { FeatureCollection, FlagProps } from "@/lib/data";
import { dateWords, type FloodLink, type Heat, loadInsights } from "@/lib/insights";

type RefFC = FeatureCollection<{ kind: "reference" | "buffer"; width_m?: number }>;

function HeatScale({ lo, hi }: { lo: number; hi: number }) {
  return (
    <div className="heat-scale" aria-label={`Colour scale from ${lo} to ${hi} degrees`}>
      <span>{Math.round(lo)} °C</span>
      <i />
      <span>{Math.round(hi)} °C</span>
    </div>
  );
}

export function heatLine(name: string, h: Heat | undefined): string | null {
  if (!h || h.water_c == null) return null;
  const parts = [h.near_c != null && h.near_c - h.water_c >= 1
    ? `On summer mornings the water of ${name} is about ${Math.round(h.water_c)} degrees, ${Math.round(h.near_c - h.water_c)} degrees cooler than the ground around it.`
    : `On summer mornings the water of ${name} is about ${Math.round(h.water_c)} degrees at the surface.`];
  if (h.cooler_near_c != null && h.cooler_near_c >= 0.5) parts.push(`Even the ground just around it is ${h.cooler_near_c.toFixed(1)} degrees cooler than ground a kilometre away.`);
  if (h.filled_hotter_c != null && h.filled_hotter_c > 0) parts.push(`Where the lake was filled in, the ground is ${h.filled_hotter_c.toFixed(1)} degrees hotter than the water.`);
  return parts.join(" ");
}

export default function LakeInsights({ id, name, reference, flags }: { id: string; name: string; reference: RefFC; flags: FeatureCollection<FlagProps> }) {
  const [heat, setHeat] = useState<Heat | undefined>();
  const [flood, setFlood] = useState<FloodLink | undefined>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadInsights().then((i) => {
      if (!live) return;
      setHeat(i.heat[id]);
      setFlood(i.floods[id]);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [id]);

  if (!ready || (!heat && !flood)) return null;
  const showFlood = flood && flood.flooded_ha_near >= 0.5;
  const line = heatLine(name, heat);

  return (
    <section className="insights" aria-labelledby="insights-title" data-jal-mood="thinking"
      data-jal={line ?? `Here is what ${name} does for the streets around it, measured from space.`}>
      <h2 id="insights-title">What this lake does for the people around it</h2>
      <div className={`insights-grid${showFlood ? "" : " single"}`}>
        {heat && heat.water_c != null && (
          <article className="card insight heat">
            <h3>It is the coolest ground around</h3>
            {heat.near_c != null && heat.near_c - heat.water_c >= 1 && (
              <p className="insight-lede">
                On summer mornings the water is <strong className="cold">{(heat.near_c - heat.water_c).toFixed(1)} °C cooler</strong> than the
                ground around it{heat.filled_hotter_c != null && heat.filled_hotter_c > 0 && <>, and the lake bed that was filled in
                has heated up by <strong className="hot">{heat.filled_hotter_c.toFixed(1)} °C</strong></>}.
              </p>
            )}
            <div className="insight-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heat.image} alt={`Summer ground temperature around ${name}: cool water in blue, hot ground in red`} />
              <Outlines bounds={heat.bounds} reference={reference} flags={flags} />
            </div>
            <HeatScale lo={heat.scale_c[0]} hi={heat.scale_c[1]} />
            <dl className="insight-stats">
              <div><dt>The lake&apos;s water</dt><dd>{heat.water_c.toFixed(1)} °C</dd></div>
              {heat.near_c != null && <div><dt>Ground {heat.near_m[0]}–{heat.near_m[1]} m away</dt><dd>{heat.near_c.toFixed(1)} °C</dd></div>}
              {heat.far_c != null && <div><dt>Ground {heat.far_m[0]}–{heat.far_m[1]} m away</dt><dd>{heat.far_c.toFixed(1)} °C</dd></div>}
              {heat.filled_c != null && heat.filled_hotter_c != null && (
                <div className="hot"><dt>Lake bed that was filled in</dt><dd>{heat.filled_c.toFixed(1)} °C <small>+{heat.filled_hotter_c.toFixed(1)} °C</small></dd></div>
              )}
            </dl>
            <p className="small muted">
              Ground surface temperature from {heat.passes} Landsat 8 and 9 passes, {heat.period}. It is the temperature of
              the ground, not the air, and trees and buildings differ around a lake too; the lake is one reason it is
              cooler, not the only one.{heat.filled_c == null && heat.filled_ac > 0 && " The filled patches here are too small for the 100 m heat sensor to measure on their own."}
            </p>
          </article>
        )}
        {showFlood && (
          <article className="card insight flood">
            <h3>Floods came close</h3>
            <div className="insight-figure flood-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flood.image} alt={`Ground flooded around ${name} on ${dateWords(flood.date)}, in blue`} />
              <Outlines bounds={flood.bounds} reference={reference} flags={flags} />
            </div>
            <p className="insight-lede">
              <strong>{flood.flooded_ha_near.toFixed(1)} hectares</strong> flooded within {flood.near_m / 1000} km of the lake
              on {dateWords(flood.date)} ({flood.name}).
              {flood.times_city != null && flood.times_city >= 1.3 && <> That is {flood.times_city.toFixed(1)} times the share flooded across the mapped city.</>}
            </p>
            <p className="small muted">
              Radar from Sentinel-1, a few hours into the flood. It misses water between tall buildings and floods that
              drained before the satellite passed, and water near a lake is not proof the lake&apos;s loss caused it.{" "}
              <Link href="/check/">Check a plot</Link> to see the flood layer at any address.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
