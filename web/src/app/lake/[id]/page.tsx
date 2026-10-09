import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { DATA_URL } from "@/lib/data";
import LakeView from "./LakeView";

type Entry = { id: string; name: string; flagged_ac: number };

// The lake list comes from wherever the app reads results: the live API (S3 behind it)
// when DATA_URL is a URL, otherwise the files synced into public/data for offline work.
async function lakes(): Promise<Entry[]> {
  if (/^https?:\/\//.test(DATA_URL)) {
    // Fetched once at build time; "no-store" would make the page dynamic, which a static export can't be.
    const res = await fetch(`${DATA_URL}/index.json`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`lake list from ${DATA_URL}: ${res.status}`);
    return (await res.json()).lakes;
  }
  return JSON.parse(readFileSync(join(process.cwd(), "public", "data", "index.json"), "utf-8")).lakes;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const lake = (await lakes()).find((l) => l.id === id);
  return {
    title: lake ? `${lake.name}: lake analysis` : "Lake analysis",
    description: lake
      ? `Satellite change in ${lake.name}'s bed and buffer since 2019: ${lake.flagged_ac.toFixed(2)} acres flagged. Dated, reproducible evidence.`
      : undefined,
  };
}

// Static export needs every lake id at build time.
export async function generateStaticParams() {
  return (await lakes()).map((l) => ({ id: l.id }));
}

export default async function LakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LakeView id={id} />;
}
