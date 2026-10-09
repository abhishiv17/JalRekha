import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Static export: Amplify serves plain files from out/; results are read at runtime
// from NEXT_PUBLIC_DATA_URL (default: /data, synced from ../data by `npm run sync-data`).
export default function config(phase: string): NextConfig {
  return {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    // The dev server gets its own folder. `next build` always works in .next, so
    // sharing it let a build delete chunks a running dev server still needed
    // ("Cannot find module './611.js'").
    ...(phase === PHASE_DEVELOPMENT_SERVER ? { distDir: ".next-dev" } : {}),
  };
}
