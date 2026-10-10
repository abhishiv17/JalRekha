// Copy pipeline results, the India lake catalog and letter templates into public/
// for local dev and static builds.
// Results: ../data/out when it has results, else ../data/sample (made-up data).
// Catalog: ../data/catalog (from pipeline/scripts/osm_india_lakes.py), if present.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Flood events (from pipeline/jalrekha/flood.py): overlay + metadata, and an index.
const floods = resolve(repo, "data", "floods");
rmSync(resolve(pub, "floods"), { recursive: true, force: true });
mkdirSync(resolve(pub, "floods"), { recursive: true });
const events = [];
if (existsSync(floods)) {
  for (const id of readdirSync(floods)) {
    const meta = resolve(floods, id, "event.json");
    if (!existsSync(meta)) continue;
    mkdirSync(resolve(pub, "floods", id), { recursive: true });
    for (const f of ["event.json", "overlay.png"]) cpSync(resolve(floods, id, f), resolve(pub, "floods", id, f));
    const e = JSON.parse(readFileSync(meta, "utf-8"));
    events.push({ id: e.id, name: e.name, date: e.date, bounds: e.bounds, flooded_km2: e.flooded_km2 });
  }
}
writeFileSync(resolve(pub, "floods", "index.json"), JSON.stringify(events));
console.log(`synced ${events.length} flood event(s)`);

// Spots a person checked by hand against older high-resolution imagery (research/flags_checked.csv).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const checked = resolve(repo, "research", "flags_checked.csv");
const checks = {};
if (existsSync(checked)) {
  for (const r of parseCsv(readFileSync(checked, "utf-8"))) {
    checks[r.flag_id] = { verdict: r.verdict, seen: r.what_seen, dates: r.imagery_dates_compared, source: r.imagery_source };
  }
}
writeFileSync(resolve(pub, "hand-checks.json"), JSON.stringify(checks));
console.log(`synced ${Object.keys(checks).length} hand-checked spots`);
