"use client";

// Jal, the guide: started from the home page hero, Jal walks you down the home page,
// explaining each part in your language, and reads it out loud only when you press Listen.
// Sections say what Jal should say: <section data-jal="This is …" data-jal-mood="curious">.
// Jal follows your scrolling, lights up the part it is talking about, and you can step
// through with Back and Next. It lives on the home page only; leaving the page closes it.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Jal, { type Mood } from "@/components/Mascot";
import { type Lang, ui, useLang } from "@/lib/lang";
import { onVoices, speak, stop, type Voice, voiceFor } from "@/lib/speech";
import { lookup, request } from "@/lib/translate";

const MOODS: Mood[] = ["happy", "curious", "scanning", "thinking", "wink", "celebrate"];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function visibleSteps(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-jal]")).filter(
    (el) => el.dataset.jal && el.getClientRects().length > 0,
  );
}

/** Jal's words in the visitor's language (English while a translation is on its way). */
function useSaid(english: string, lang: Lang) {
  const [said, setSaid] = useState({ text: english, ready: true });
  useEffect(() => {
    const have = lookup(english, lang);
    const done = lang === "en" || have !== undefined || !english;
    setSaid({ text: have ?? english, ready: done });
    if (done) return;
    let live = true;
    void request(english, lang).then((out) => live && setSaid({ text: out ?? english, ready: true }));
    return () => {
      live = false;
    };
  }, [english, lang]);
  return said;
}

export default function JalGuide() {
  const { lang, guideOn, setGuideOn } = useLang();
  const path = usePathname();
  const home = path === "/";
  const [steps, setSteps] = useState<HTMLElement[]>([]);
  const [active, setActive] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false); // Jal only speaks when asked
  const [speaking, setSpeaking] = useState(false);
  const [voice, setVoice] = useState<Voice>("none");
  const manualUntil = useRef(0);
  const ratios = useRef(new Map<Element, number>());

  // Only the home page has a guide: going anywhere else closes it.
  useEffect(() => {
    if (!home && guideOn) setGuideOn(false);
  }, [home, guideOn, setGuideOn]);

  // Find the parts of the page Jal can talk about (pages load in pieces, so keep looking).
  useEffect(() => {
    if (!home) {
      setSteps([]);
      return;
    }
    let t = 0;
    const scan = () => {
      const next = visibleSteps();
      setSteps((prev) => (prev.length === next.length && prev.every((el, i) => el === next[i]) ? prev : next));
    };
    scan();
    const obs = new MutationObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(scan, 400);
    });
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-jal"] });
    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, [home]);

  useEffect(() => setActive(0), [path]);
  useEffect(() => {
    if (active >= steps.length && steps.length) setActive(steps.length - 1);
  }, [steps, active]);

  // Follow the reader: the part filling most of the middle of the screen is the one Jal explains.
  useEffect(() => {
    if (!guideOn || !steps.length) return;
    ratios.current = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) ratios.current.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
      if (Date.now() < manualUntil.current) return;
      let best = -1, bestR = 0;
      steps.forEach((el, i) => {
        const r = ratios.current.get(el) ?? 0;
        if (r > bestR) {
          best = i;
          bestR = r;
        }
      });
      if (best >= 0) setActive(best);
    }, { rootMargin: "-30% 0px -40% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    steps.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [guideOn, steps]);

  const el = steps[active];
  const english = el?.dataset.jal ?? "";
  const { text: said, ready } = useSaid(english, lang);
  const mood = (el?.dataset.jalMood as Mood | undefined) ?? MOODS[active % MOODS.length];

  // Light up the part Jal is talking about.
  useEffect(() => {
    if (!guideOn || !el) return;
    el.classList.add("jal-spot");
    return () => el.classList.remove("jal-spot");
  }, [guideOn, el]);

  useEffect(() => {
    document.body.classList.toggle("jal-on", guideOn);
    if (!guideOn) stop();
  }, [guideOn]);

  const refreshVoice = useCallback(() => setVoice(voiceFor(lang)), [lang]);
  useEffect(() => {
    refreshVoice();
    return onVoices(refreshVoice);
  }, [refreshVoice]);

  // Read the current part once when Listen is pressed; moving on to another part stops it.
  useEffect(() => {
    if (!guideOn || !voiceOn || !said || !ready) return;
    setSpeaking(true);
    void speak(said, lang, () => {
      setSpeaking(false);
      setVoiceOn(false);
    }).then((v) => setVoice(v === "none" ? voiceFor(lang) : v));
  }, [guideOn, voiceOn, said, ready, lang]);
  useEffect(() => {
    stop();
    setVoiceOn(false);
  }, [active]);

  const go = useCallback((i: number) => {
    const target = steps[i];
    if (!target) return;
    manualUntil.current = Date.now() + 1200;
    setActive(i);
    target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
  }, [steps]);

  const toggleVoice = () => {
    if (voiceOn) stop();
    setVoiceOn(!voiceOn);
  };

  if (!home || !guideOn) return null;
  return (
    <aside className={`jal-dock${speaking ? " talking" : ""}`} aria-label="Jal, your guide" data-no-translate
      onKeyDown={(e) => {
        if (e.key === "Escape") setGuideOn(false);
        if (e.key === "ArrowRight") go(Math.min(active + 1, steps.length - 1));
        if (e.key === "ArrowLeft") go(Math.max(active - 1, 0));
      }}>
      <div className="jal-dock-head">
        <span className="jal-avatar"><Jal size={34} interactive={false} mood={speaking ? "happy" : mood} /></span>
        <strong>Jal</strong>
        {steps.length > 0 && <span className="jal-step">{active + 1}/{steps.length}</span>}
        {speaking && <span className="jal-eq" aria-hidden="true"><i /><i /><i /><i /></span>}
        <button type="button" className="jal-x" aria-label={ui("close", lang)} onClick={() => setGuideOn(false)}>×</button>
      </div>

      <p className="jal-line" lang={lang} aria-live="polite" key={`${active}-${lang}`}>
        {steps.length ? said : ui("scroll", lang)}
      </p>

      <div className="jal-controls">
        <button type="button" className="ghost" onClick={() => go(active - 1)} disabled={active <= 0} aria-label={ui("back", lang)}>←</button>
        {voice !== "none" && (
          <button type="button" className={`jal-play${voiceOn ? " on" : ""}`} aria-pressed={voiceOn} onClick={toggleVoice}>
            <SpeakerIcon off={voiceOn} /> {voiceOn ? ui("pause", lang) : ui("listen", lang)}
          </button>
        )}
        <button type="button" onClick={() => go(active + 1)} disabled={active >= steps.length - 1} aria-label={ui("next", lang)}>→</button>
      </div>
    </aside>
  );
}

export function SpeakerIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {off ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}
