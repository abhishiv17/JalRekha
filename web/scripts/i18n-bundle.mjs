// Build the phrase books the site ships with (public/i18n/<lang>.json), so pages open already
// translated instead of waiting for the API.
//
//   node scripts/i18n-bundle.mjs <site URL> <Plot Check API URL>
//   node scripts/i18n-bundle.mjs https://main.d25xaqqlm27lpb.amplifyapp.com https://d3nw1z8j2g.execute-api.us-west-2.amazonaws.com
//   node scripts/i18n-bundle.mjs <site URL> --harvest-only     (just list the phrases)
//
// 1. Opens every page in headless Chrome with ?jal-harvest, which makes the page list every
//    phrase on it (components/PageTranslator.tsx), including what Jal says.
// 2. Sends the phrases to <API>/translate (Amazon Translate; the API keeps every answer).
// 3. Merges the answers into public/i18n/hi.json, kn.json and te.json.
// Set CHROME to the browser's path if it isn't found.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [site, api] = process.argv.slice(2);
if (!site || !api) {
  console.error("usage: node scripts/i18n-bundle.mjs <site URL> <Plot Check API URL | --harvest-only>");
  process.exit(1);
}
const SITE = site.replace(/\/$/, "");
const LANGS = ["hi", "kn", "te"];
const OUT = resolve(import.meta.dirname, "..", "public", "i18n");

const CHROME = process.env.CHROME ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));
if (!CHROME) {
  console.error("Chrome not found: set CHROME=/path/to/chrome");
  process.exit(1);
}

function harvest(path) {
  const url = `${SITE}${path}${path.includes("?") ? "&" : "?"}jal-harvest`;
  const html = execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--virtual-time-budget=20000", "--dump-dom", url],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  const m = html.match(/<script id="jal-harvest" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  const text = m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return JSON.parse(text);
}

const index = await fetch(`${(process.env.DATA_URL ?? (api.startsWith("http") ? api : SITE)).replace(/\/$/, "")}/index.json`)
  .then((r) => r.json()).catch(() => ({ lakes: [] }));
const pages = ["/", "/lakes/", "/check/", "/ponds/", "/ponds/board/", "/watchlist/",
  ...index.lakes.flatMap((l) => [`/lake/${l.id}/`, `/lake/${l.id}/evidence/`])];

const phrases = new Set();
for (const p of pages) {
  const found = harvest(p);
  found.forEach((t) => phrases.add(t));
  console.log(`${String(found.length).padStart(4)} phrases  ${p}`);
}
const all = Array.from(phrases).filter((t) => t.length <= 600).sort();
console.log(`${all.length} different phrases`);

if (api === "--harvest-only") {
  writeFileSync(resolve(OUT, "phrases.txt"), all.join("\n") + "\n");
  console.log(`wrote ${resolve(OUT, "phrases.txt")}`);
  process.exit(0);
}

const API = api.replace(/\/$/, "");
for (const lang of LANGS) {
  const file = resolve(OUT, `${lang}.json`);
  const book = existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : {};
  const todo = all.filter((t) => !(t in book));
  for (let i = 0; i < todo.length; i += 60) {
    const part = todo.slice(i, i + 60);
    const r = await fetch(`${API}/translate`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, texts: part }),
    });
    if (!r.ok) throw new Error(`${lang}: ${r.status} ${await r.text()}`);
    const { texts } = await r.json();
    part.forEach((t, j) => (book[t] = texts[j]));
    process.stdout.write(`\r${lang}: ${Math.min(i + 60, todo.length)}/${todo.length}`);
  }
  const sorted = Object.fromEntries(Object.entries(book).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, JSON.stringify(sorted, null, 0) + "\n");
  console.log(`\n${lang}: ${Object.keys(sorted).length} phrases in ${file}`);
}
