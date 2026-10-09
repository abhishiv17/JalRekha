import { readFileSync } from "node:fs";
import { join } from "node:path";
import LakeView from "./LakeView";

// Static export needs every lake id at build time; `prebuild` syncs public/data first.
export function generateStaticParams() {
  const index = JSON.parse(readFileSync(join(process.cwd(), "public", "data", "index.json"), "utf-8"));
  return index.lakes.map((l: { id: string }) => ({ id: l.id }));
}

export default async function LakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LakeView id={id} />;
}
