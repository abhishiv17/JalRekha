// English text -> Hindi, Kannada or Telugu, by Amazon Translate behind the Plot Check API.
//
// Three places are tried in order, so a phrase is translated once and then instant:
//   1. /i18n/<lang>.json, built from the site's own pages (web/scripts/i18n-bundle.mjs);
//   2. this browser's copy of earlier answers;
//   3. POST <PLOT_API>/translate, which also keeps every answer in DynamoDB.
// If the API can't be reached the text simply stays in English.

import type { Lang } from "./lang";

const API = (process.env.NEXT_PUBLIC_PLOT_API_URL ?? "").trim().replace(/\/$/, "");
const BATCH = 60;
const MAX_CHARS = 600;
const STORE = (lang: Lang) => `jalrekha.i18n.${lang}`;

type Waiter = (out: string | null) => void;

const known = new Map<Lang, Map<string, string>>();
const bundles = new Map<Lang, Promise<void>>();
const queue = new Map<Lang, Map<string, Waiter[]>>();
const timers = new Map<Lang, number>();
let apiDownUntil = 0;
// "down" once the service couldn't answer (or isn't configured), "ok" once it has.
let status: "unknown" | "ok" | "down" = "unknown";
const statusListeners = new Set<(s: typeof status) => void>();
function setStatus(s: typeof status) {
  if (s === status) return;
  status = s;
  for (const fn of statusListeners) fn(s);
}
export function onStatus(fn: (s: "unknown" | "ok" | "down") => void) {
  statusListeners.add(fn);
  fn(status);
  return () => void statusListeners.delete(fn);
}
let inFlight = 0;
const listeners = new Set<(n: number) => void>();

/** Same words, same key: collapse runs of spaces and line breaks. */
export const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Worth translating: English words, not a bare number, URL, e-mail or already-translated text. */
export function translatable(s: string) {
  const t = norm(s);
  return t.length > 1 && t.length <= MAX_CHARS && /[A-Za-z]{2}/.test(t) && !/^(https?:|www\.|[\w.-]+@)/.test(t);
}

function table(lang: Lang) {
  let m = known.get(lang);
  if (!m) {
    m = new Map();
    known.set(lang, m);
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE(lang)) ?? "{}") as Record<string, string>;
      for (const [k, v] of Object.entries(saved)) m.set(k, v);
    } catch {
      /* nothing saved, or storage blocked */
    }
  }
  return m;
}

let saveTimer = 0;
function save(lang: Lang) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      // Keep the most recent ~4,000 phrases; the bundle and the API hold the rest.
      const entries = Array.from(table(lang)).slice(-4000);
      window.localStorage.setItem(STORE(lang), JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* storage full or blocked: still fine for this visit */
    }
  }, 800);
}

/** Load the prebuilt phrase book for a language (once). Missing file is fine. */
export function loadBundle(lang: Lang): Promise<void> {
  if (lang === "en") return Promise.resolve();
  let p = bundles.get(lang);
  if (!p) {
    p = fetch(`/i18n/${lang}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => {
        const m = table(lang);
        for (const [k, v] of Object.entries(data)) if (!m.has(k)) m.set(k, v);
      })
      .catch(() => {});
    bundles.set(lang, p);
  }
  return p;
}

/** The translation if we already have it. */
export function lookup(text: string, lang: Lang): string | undefined {
  if (lang === "en") return text;
  return table(lang).get(norm(text));
}

export function onPending(fn: (n: number) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function pendingCount() {
  let n = inFlight;
  for (const q of queue.values()) n += q.size;
  return n;
}

function notify() {
  const n = pendingCount();
  for (const fn of listeners) fn(n);
}

async function flush(lang: Lang) {
  timers.delete(lang);
  const q = queue.get(lang);
  if (!q || q.size === 0) return;
  queue.delete(lang);
  const texts = Array.from(q.keys());
  for (let i = 0; i < texts.length; i += BATCH) {
    const part = texts.slice(i, i + BATCH);
    let out: string[] | null = null;
    if (API && Date.now() > apiDownUntil) {
      inFlight += part.length;
      notify();
      try {
        const r = await fetch(`${API}/translate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang, texts: part }),
        });
        if (r.ok) {
          out = ((await r.json()) as { texts: string[] }).texts;
          setStatus("ok");
        } else if (r.status >= 500 || r.status === 404) {
          apiDownUntil = Date.now() + 60_000;
          setStatus("down");
        }
      } catch {
        apiDownUntil = Date.now() + 60_000;
        setStatus("down");
      } finally {
        inFlight -= part.length;
      }
    }
    if (!API) setStatus("down");
    const m = table(lang);
    part.forEach((t, j) => {
      const tr = out?.[j];
      if (tr) m.set(t, tr);
      for (const w of q.get(t) ?? []) w(tr ?? null);
    });
    if (out) save(lang);
    notify();
  }
}

/** Ask for a translation; resolves with null if it can't be had right now. */
export function request(text: string, lang: Lang): Promise<string | null> {
  const key = norm(text);
  const have = lookup(key, lang);
  if (have !== undefined) return Promise.resolve(have);
  if (!translatable(key)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let q = queue.get(lang);
    if (!q) {
      q = new Map();
      queue.set(lang, q);
    }
    const waiters = q.get(key) ?? [];
    waiters.push(resolve);
    q.set(key, waiters);
    if (!timers.has(lang)) timers.set(lang, window.setTimeout(() => void flush(lang), 120));
    notify();
  });
}

export const translationAvailable = () => Boolean(API);
