// Copy pipeline results, the India lake catalog and letter templates into public/
// for local dev and static builds.
// Results: ../data/out when it has results, else ../data/sample (made-up data).
// Catalog: ../data/catalog (from pipeline/scripts/osm_india_lakes.py), if present.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..", "..");
const out = resolve(repo, "data", "out");
const results = existsSync(resolve(out, "index.json")) ? out : resolve(repo, "data", "sample");
const pub = resolve(import.meta.dirname, "..", "public");

function copy(from, to) {
  rmSync(resolve(pub, to), { recursive: true, force: true });
  cpSync(from, resolve(pub, to), { recursive: true });
  console.log(`synced ${from} -> public/${to}`);
}

copy(results, "data");
copy(resolve(repo, "templates"), "templates");

const catalog = resolve(repo, "data", "catalog");
rmSync(resolve(pub, "catalog"), { recursive: true, force: true });
mkdirSync(resolve(pub, "catalog"), { recursive: true });
let meta = { lakes: 0, states: 0 };
if (existsSync(resolve(catalog, "india.json"))) {
  cpSync(resolve(catalog, "india.json"), resolve(pub, "catalog", "india.json"));
  cpSync(resolve(catalog, "shapes"), resolve(pub, "catalog", "shapes"), { recursive: true });
  const lakes = JSON.parse(readFileSync(resolve(catalog, "india.json"), "utf-8"));
  meta = { lakes: lakes.length, states: new Set(lakes.map((l) => l.state)).size };
  console.log(`synced catalog: ${meta.lakes} lakes in ${meta.states} states/UTs`);
} else {
  console.log("no catalog yet (run pipeline/scripts/osm_india_lakes.py)");
}
writeFileSync(resolve(pub, "catalog", "meta.json"), JSON.stringify(meta));
