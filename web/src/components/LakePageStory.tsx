"use client";

// The lake story for one tracked lake, built from its own results: its first and latest
// clear dry-season photos, outline, 30-metre zone, open water and lost spots, with the
// six steps written from its numbers. Shown on every lake page above "Compare two years".

import { useEffect, useMemo, useState } from "react";
import LakeStory, { type StoryData, type StoryEnd, type StoryStep } from "@/components/LakeStory";
import { KIND_LABELS } from "@/lib/catalog";
import { type FeatureCollection, type FlagProps, type Stats, lakeUrl } from "@/lib/data";
import { boxOf, centreOf, projector, toPath, toPathNear } from "@/lib/story";

type Geom = { type: string; coordinates: unknown };
type Reference = FeatureCollection<{ kind: "reference" | "buffer"; width_m?: number }>;

const year = (season: string) => Number(season.slice(0, 4));
const acres = (n: number) => `${n.toFixed(2)} acres`;

export default function LakePageStory({ id, name, placeText, stats, flags, reference, bounds, usable, zoneLaw, proofHref }: {
  id: string;
  name: string;
  placeText?: string;
  stats: Stats;
  flags: FeatureCollection<FlagProps>;
  reference: Reference;
  bounds: [number, number, number, number];
  usable: string[]; // clear dry seasons, oldest first
  zoneLaw: string;
  proofHref: string;
}) {
  const first = usable[0], last = usable[usable.length - 1];
  const [water, setWater] = useState<FeatureCollection | null>(null);
  // Story photos (pipeline/jalrekha/story.py): a square at least 1.5 km across, made the
  // same way for every lake. Lakes without them fall back to their analysis photos.
  const [photos, setPhotos] = useState<{ bounds: [number, number, number, number]; years: number[] } | null | undefined>(undefined);

  useEffect(() => {
    fetch(`${lakeUrl(id, `water/${last}.geojson`)}?map=1`).then((r) => r.json()).then(setWater).catch(() => setWater(null));
    fetch(`${lakeUrl(id, "story/meta.json")}?map=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setPhotos(m && m.years?.length >= 2 ? m : null))
      .catch(() => setPhotos(null));
  }, [id, last]);

  const built = useMemo(() => {
    if (!water || photos === undefined) return null;
    const frame = photos ? photos.bounds : bounds;
    const { w, h, xy } = projector(frame);
    const outline = reference.features.find((f) => f.properties.kind === "reference")?.geometry as Geom | undefined;
    const zone = reference.features.find((f) => f.properties.kind === "buffer" && f.properties.width_m === 30)?.geometry as Geom | undefined;
    const spots = flags.features.map((f) => toPath(f.geometry as Geom, xy)).filter(Boolean);
    const biggest = [...flags.features].sort((a, b) => b.properties.area_ac - a.properties.area_ac)[0];
    const lost = stats.flags_total_ac;
    const data: StoryData = {
      w, h,
      before: photos ? `${lakeUrl(id, `story/${photos.years[0]}.jpg`)}?map=1` : `${lakeUrl(id, `truecolor/${first}.png`)}?map=1`,
      after: photos ? `${lakeUrl(id, `story/${photos.years[photos.years.length - 1]}.jpg`)}?map=1` : `${lakeUrl(id, `truecolor/${last}.png`)}?map=1`,
      beforeYear: photos ? photos.years[0] : year(first),
      afterYear: photos ? photos.years[photos.years.length - 1] : year(last),
      outline: toPath(outline, xy),
      zone: toPath(zone, xy),
      // Only the water at this lake (its 30-metre zone's box), not stray wet patches in the photo.
      water: (() => {
        const box = boxOf(zone ?? outline, xy, 4);
        return water.features.map((f) => (box ? toPathNear(f.geometry as Geom, xy, box) : toPath(f.geometry as Geom, xy))).join("");
      })(),
      spots,
      callout: biggest && lost > 0
        ? (() => {
            const c = centreOf(biggest.geometry as Geom, xy, w, h);
            return c ? { text: <><b>{acres(lost)}</b> became land</>, ...c } : null;
          })()
        : null,
    };
    return data;
  }, [water, photos, bounds, reference, flags, stats.flags_total_ac, id, first, last]);

  if (!built) return <div className="story-placeholder" />;

  const fy = year(first), ly = year(last);
  const latest = stats.seasons.find((s) => s.season === last);
  const open = latest?.water_ac ?? 0, weeds = latest?.floating_veg_ac ?? 0;
  const lost = stats.flags_total_ac;
  const inZone = stats.buffer.change_in_buffer_ac["30"] ?? 0;
  const fs = flags.features.map((f) => f.properties);
  const firm = fs.some((f) => f.confidence !== "low");
  const kinds = Object.keys(KIND_LABELS)
    .map((k) => ({ label: KIND_LABELS[k].toLowerCase(), area: fs.filter((f) => (f.kind ?? "fill_or_construction") === k).reduce((a, f) => a + f.area_ac, 0) }))
    .filter((x) => x.area > 0)
    .map((x) => `${acres(x.area)} ${x.label}`)
    .join(", ");

  const steps: StoryStep[] = [
    { title: "Start with the lake", mood: "happy", chip: `Satellite photo · Jan–Apr ${fy}`,
      text: `This is ${name}${placeText ? ` in ${placeText}` : ""}, seen from space in ${fy}. The white line is the edge of the lake.` },
    { title: "Look at it every year", mood: "scanning", chip: `Satellite photo · Jan–Apr ${ly}`,
      text: `Satellites photograph it every few days. We compare the same months each year, ${fy} to ${ly}, so a dry summer can't fool us.` },
    { title: "Find the water", mood: "thinking", chip: "Open water in blue",
      text: `Blue is open water in ${ly}: ${acres(open)}.${weeds > 0.5 ? ` Another ${acres(weeds)} is weeds floating on water, which still counts as lake.` : ""}` },
    lost > 0
      ? { title: "Spot where the lake became land", mood: "worried", chip: "Lake turned to land in orange",
          text: `Orange is lake bed that turned into land since ${fy}: ${acres(lost)}${kinds ? ` (${kinds})` : ""}.${firm ? "" : " None of it is sure yet, so it needs a second look."}` }
      : { title: "Look for lake that became land", mood: "celebrate", chip: "No lake lost",
          text: `No part of the lake turned into land between ${fy} and ${ly}. Good news.` },
    { title: "Check the no-build zone", mood: "cautious", chip: "30-metre no-build zone",
      text: `The yellow ring is 30 metres around the lake. ${zoneLaw} ${inZone > 0 ? `${acres(inZone)} of change sits inside it.` : "Nothing changed inside it."}` },
    lost > 0
      ? { title: "Get proof to act", mood: "celebrate", chip: "Proof ready",
          text: "Download dated photos, map points and a ready letter to the city. Or watch the lake and get an email if it shrinks again." }
      : { title: "Keep watching", mood: "happy", chip: "Keep watching",
          text: "Lakes can change in any year. Watch this lake and we'll email you if it starts to shrink." },
  ];
  const end: StoryEnd = lost > 0
    ? { title: "Proof ready", text: "Dated photos · map points · complaint letter · Right to Information request", href: proofHref, label: "Download proof" }
    : { title: "Keep watching", text: "One email if this lake starts to shrink.", href: "#watch", label: "Watch this lake", mood: "happy" };

  return <LakeStory data={built} steps={steps} end={end} label={`${name}, step by step`} mode="stepper" />;
}
