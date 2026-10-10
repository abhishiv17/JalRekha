"use client";

// Shows every page in the visitor's language without touching the pages themselves.
//
// It walks the text on screen, swaps each piece for its translation (lib/translate), and keeps
// the English beside it so switching back is exact. React keeps working: we only ever change a
// text node's value, never add or remove nodes, and when React writes new English into a node
// the observer sees it and translates that too.
//
// An element whose children are all text (say "27 lakes tracked in 6 cities", which React keeps
// as several text nodes) is translated as one sentence, so the grammar comes out right.
// Anything inside [data-no-translate], [translate="no"], maps, SVG, code or form fields stays.
//
// ?jal-harvest on a URL collects every phrase on the page into <script id="jal-harvest">,
// which web/scripts/i18n-bundle.mjs turns into the prebuilt phrase books.

import { useEffect, useRef, useState } from "react";
import { type Lang, ui, useLang } from "@/lib/lang";
import { loadBundle, lookup, norm, onPending, onStatus, request, translatable } from "@/lib/translate";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG", "CANVAS", "IFRAME", "TITLE"]);
const SKIP_SELECTOR = "[data-no-translate],[translate='no'],.maplibregl-map,svg,[contenteditable='true']";
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

type Rec = { src: string; out: string };
const texts = new WeakMap<Text, Rec>();
const attrs = new WeakMap<Element, Partial<Record<(typeof ATTRS)[number], Rec>>>();
const touched = new Set<Text>();
const touchedEls = new Set<Element>();

/** What React last put in this node: our translation stands for the English it replaced. */
function sourceOf(node: Text) {
  const r = texts.get(node);
  return r && node.nodeValue === r.out ? r.src : node.nodeValue ?? "";
}

function skipped(el: Element | null) {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
  return Boolean(el.closest(SKIP_SELECTOR));
}

type Segment = { nodes: Text[]; source: string };

function segments(root: Element): { segs: Segment[]; els: Element[] } {
  const segs: Segment[] = [];
  const els: Element[] = [];
  const visit = (el: Element) => {
    if (skipped(el)) return;
    if (ATTRS.some((a) => el.hasAttribute(a))) els.push(el);
    const kids = Array.from(el.childNodes);
    const textKids = kids.filter((n): n is Text => n.nodeType === Node.TEXT_NODE);
    if (textKids.length > 1 && textKids.length === kids.length) {
      segs.push({ nodes: textKids, source: textKids.map(sourceOf).join("") });
      return;
    }
    for (const n of kids) {
      if (n.nodeType === Node.TEXT_NODE) segs.push({ nodes: [n as Text], source: sourceOf(n as Text) });
      else if (n.nodeType === Node.ELEMENT_NODE) visit(n as Element);
    }
  };
  visit(root);
  return { segs: segs.filter((s) => translatable(s.source)), els };
}

/** The page's language attribute follows what is actually on screen, so a page still in
 *  English keeps English typography until the first translation lands. */
let shownLang: Lang = "en";
let shown = 0;
const shownListeners = new Set<(n: number) => void>();
function markShown(lang: Lang) {
  shown++;
  if (shownLang !== lang) {
    shownLang = lang;
    document.documentElement.lang = lang;
  }
  if (shown === 1) for (const fn of shownListeners) fn(shown);
}
function resetShown() {
  shown = 0;
  shownLang = "en";
  document.documentElement.lang = "en";
  for (const fn of shownListeners) fn(0);
}

function apply(seg: Segment, translated: string, lang: Lang) {
  markShown(lang);
  const lead = seg.source.match(/^\s*/)?.[0] ?? "";
  const trail = seg.source.match(/\s*$/)?.[0] ?? "";
  seg.nodes.forEach((node, i) => {
    const src = sourceOf(node);
    const out = i === 0 ? `${lead}${translated}${trail}` : "";
    texts.set(node, { src, out });
    touched.add(node);
    if (node.nodeValue !== out) node.nodeValue = out;
  });
}

function restoreAll() {
  for (const node of touched) {
    const r = texts.get(node);
    if (r && node.isConnected && node.nodeValue === r.out) node.nodeValue = r.src;
    texts.delete(node);
  }
  touched.clear();
  for (const el of touchedEls) {
    const rec = attrs.get(el);
    if (rec && el.isConnected) {
      for (const a of ATTRS) {
        const r = rec[a];
        if (r && el.getAttribute(a) === r.out) el.setAttribute(a, r.src);
      }
    }
    attrs.delete(el);
  }
  touchedEls.clear();
}

function translateAttrs(el: Element, lang: Lang) {
  const rec = attrs.get(el) ?? {};
  for (const a of ATTRS) {
    const now = el.getAttribute(a);
    if (now == null) continue;
    const src = rec[a] && now === rec[a]!.out ? rec[a]!.src : now;
    if (!translatable(src)) continue;
    const put = (out: string) => {
      if ((el.getAttribute(a) ?? "") !== now) return; // changed meanwhile
      rec[a] = { src, out };
      attrs.set(el, rec);
      touchedEls.add(el);
      el.setAttribute(a, out);
    };
    const have = lookup(src, lang);
    if (have !== undefined) put(have);
    else void request(src, lang).then((out) => out && put(out));
  }
}

function translateTree(root: Element, lang: Lang) {
  const { segs, els } = segments(root);
  for (const seg of segs) {
    const have = lookup(seg.source, lang);
    if (have !== undefined) {
      apply(seg, have, lang);
      continue;
    }
    void request(norm(seg.source), lang).then((out) => {
      if (!out) return;
      // Only if the page still shows the English we asked about.
      if (seg.nodes.every((n) => n.isConnected) && seg.nodes.map(sourceOf).join("") === seg.source) apply(seg, out, lang);
    });
  }
  for (const el of els) translateAttrs(el, lang);
}

function harvest() {
  const { segs, els } = segments(document.body);
  const found = new Set<string>();
  for (const s of segs) found.add(norm(s.source));
  for (const el of els) for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && translatable(v)) found.add(norm(v));
  }
  document.querySelectorAll<HTMLElement>("[data-jal]").forEach((el) => {
    const v = el.dataset.jal;
    if (v && translatable(v)) found.add(norm(v));
  });
  let out = document.getElementById("jal-harvest");
  if (!out) {
    out = document.createElement("script");
    out.id = "jal-harvest";
    out.setAttribute("type", "application/json");
    document.body.appendChild(out);
  }
  out.textContent = JSON.stringify(Array.from(found));
}

export default function PageTranslator() {
  const { lang, setLang, setPending } = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [service, setService] = useState<"unknown" | "ok" | "down">("unknown");
  const [anyShown, setAnyShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => onStatus(setService), []);
  useEffect(() => {
    const fn = (n: number) => setAnyShown(n > 0);
    shownListeners.add(fn);
    return () => void shownListeners.delete(fn);
  }, []);
  useEffect(() => setDismissed(false), [lang]);

  useEffect(() => onPending(setPending), [setPending]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("jal-harvest")) return;
    const t = window.setInterval(harvest, 1500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (lang === "en") {
      restoreAll();
      resetShown();
      return;
    }
    let cancelled = false;
    let dirty = new Set<Element>();
    let frame = 0;
    const run = () => {
      frame = 0;
      const roots = Array.from(dirty).filter((el) => el.isConnected && !Array.from(dirty).some((o) => o !== el && o.contains(el)));
      dirty = new Set();
      for (const r of roots) translateTree(r, langRef.current);
    };
    const schedule = (el: Element) => {
      dirty.add(el);
      if (!frame) frame = window.requestAnimationFrame(run);
    };

    // Switching from one Indian language to another: start again from the English.
    restoreAll();
    resetShown();
    void loadBundle(lang).then(() => {
      if (!cancelled) schedule(document.body);
    });

    const obs = new MutationObserver((records) => {
      for (const m of records) {
        if (m.type === "characterData") {
          const node = m.target as Text;
          const r = texts.get(node);
          if (r && node.nodeValue === r.out) continue; // our own write
          if (node.parentElement) schedule(node.parentElement);
        } else if (m.type === "attributes") {
          const el = m.target as Element;
          const r = attrs.get(el)?.[m.attributeName as (typeof ATTRS)[number]];
          if (r && el.getAttribute(m.attributeName!) === r.out) continue;
          schedule(el);
        } else {
          const el = m.target as Element;
          if (m.addedNodes.length) schedule(el);
        }
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => {
      cancelled = true;
      obs.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [lang]);

  // Say so, in the chosen language, when the page can't be translated right now.
  if (lang === "en" || anyShown || service !== "down" || dismissed) return null;
  return (
    <div className="translate-notice" role="status" lang={lang} data-no-translate>
      <span>{ui("unavailable", lang)}</span>
      <button type="button" onClick={() => setLang("en")}>{ui("toEnglish", lang)}</button>
      <button type="button" className="jal-x" aria-label={ui("close", lang)} onClick={() => setDismissed(true)}>×</button>
    </div>
  );
}
