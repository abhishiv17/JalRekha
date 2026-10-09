import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import LakeView from "./LakeView";

function lakes(): { id: string; name: string; flagged_ac: number }[] {
  return JSON.parse(readFileSync(join(process.cwd(), "public", "data", "index.json"), "utf-8")).lakes;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const lake = lakes().find((l) => l.id === id);
  return {
    title: lake ? `${lake.name}: lake analysis` : "Lake analysis",
    description: lake
      ? `Satellite change in ${lake.name}'s bed and buffer since 2019: ${lake.flagged_ac.toFixed(2)} acres flagged. Dated, reproducible evidence.`
      : undefined,
  };
}

// Static export needs every lake id at build time; `prebuild` syncs public/data first.
export function generateStaticParams() {
  return lakes().map((l) => ({ id: l.id }));
}

export default async function LakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LakeView id={id} />;
}
