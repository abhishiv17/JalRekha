"use client";

// Jal, the guide: turn it on and Jal walks you down the page, explaining each part in your
// language and reading it out loud. A page opts in by putting what Jal should say on its
// sections: <section data-jal="This is …" data-jal-mood="curious">. Jal follows your scrolling,
// lights up the part it is talking about, and you can step through with Back and Next.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Jal, { type Mood } from "@/components/Mascot";
import { type Lang, LANGS, ui, useLang } from "@/lib/lang";
import { onVoices, speak, stop, type Voice, voiceFor } from "@/lib/speech";
import { lookup, request } from "@/lib/translate";

const INVITE_KEY = "jalrekha.guide-invite";
const MOODS: Mood[] = ["happy", "curious", "scanning", "thinking", "wink", "celebrate"];

function seen(key: string) {
  try {
    return window.localStorage.getItem(key) === "done";
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, "done");
  } catch {
    /* fine */
  }
}

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

export function JalToggle({ compact = false }: { compact?: boolean }) {
  const { lang, guideOn, setGuideOn } = useLang();
  return (
    <button type="button" className={`jal-toggle${guideOn ? " on" : ""}${compact ? " compact" : ""}`} aria-pressed={guideOn}
      onClick={() => setGuideOn(!guideOn)} title={ui("guide", lang)} data-no-translate>
      <span className="jal-toggle-face" aria-hidden="true"><Jal size={26} interactive={false} mood={guideOn ? "celebrate" : "happy"} /></span>
      {!compact && <span className="jal-toggle-label">{ui("guide", lang)}</span>}
      <span className="jal-switch" aria-hidden="true"><i /></span>
    </button>
  );
}

function Invite({ steps }: { steps: number }) {
  const { setLang, setGuideOn, guideOn } = useLang();
  const [show, setShow] = useState(false);
  const path = usePathname();

  useEffect(() => {
    if (guideOn || steps < 2 || seen(INVITE_KEY)) return;
    // On the home page, let the headline be read first: offer once they start exploring.
    const home = path === "/";
    const t = window.setTimeout(() => setShow(true), home ? 10000 : 3500);
    const onScroll = () => home && window.scrollY > 300 && setShow(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [guideOn, steps, path]);

  if (!show || guideOn) return null;
  const close = () => {
    markSeen(INVITE_KEY);
    setShow(false);
  };
  const start = (l: Lang) => {
    setLang(l);
    setGuideOn(true);
    close();
  };
  return (
    <aside className="jal-invite" aria-label="Jal can guide you" data-no-translate>
      <div className="jal-invite-peek" aria-hidden="true"><Jal size={84} interactive={false} mood="wink" /></div>
      <button type="button" className="jal-x" aria-label="Not now" onClick={close}>×</button>
      <p className="jal-invite-title">Want a walk-through?</p>
      <p className="jal-invite-text">
        I&apos;m Jal. I&apos;ll take you through this page, part by part, and read it out loud.
      </p>
      <div className="jal-invite-langs" role="group" aria-label="Start the guide in">
        {LANGS.map((l) => (
          <button key={l.id} type="button" lang={l.id} onClick={() => start(l.id)}>{l.native}</button>
        ))}
      </div>
      <button type="button" className="jal-later" onClick={close}>Not now</button>
    </aside>
  );
}

export default function JalGuide() {
  const { lang, setLang, guideOn, setGuideOn } = useLang();
  const path = usePathname();
  const [steps, setSteps] = useState<HTMLElement[]>([]);
  const [active, setActive] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false); // Jal only speaks when asked
  const [speaking, setSpeaking] = useState(false);
  const [voice, setVoice] = useState<Voice>("none");
  const manualUntil = useRef(0);
  const ratios = useRef(new Map<Element, number>());

  // Find the parts of the page Jal can talk about (pages load in pieces, so keep looking).
  useEffect(() => {
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
  }, [path]);

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

  const dots = useMemo(() => steps.map((_, i) => i), [steps]);

  return (
    <>
      <Invite steps={steps.length} />
      {guideOn && (
        <aside className={`jal-dock${speaking ? " talking" : ""}`} aria-label="Jal, your guide" data-no-translate
          onKeyDown={(e) => {
            if (e.key === "Escape") setGuideOn(false);
            if (e.key === "ArrowRight") go(Math.min(active + 1, steps.length - 1));
            if (e.key === "ArrowLeft") go(Math.max(active - 1, 0));
          }}>
          <div className="jal-dock-water" aria-hidden="true" />
          <div className="jal-dock-head">
            <span className="jal-avatar"><Jal size={62} interactive={false} mood={speaking ? "happy" : mood} /></span>
            <div className="jal-dock-who">
              <strong>Jal</strong>
              <span>{steps.length ? `${ui("step", lang)} ${active + 1} / ${steps.length}` : ui("guide", lang)}</span>
            </div>
            {speaking && <span className="jal-eq" aria-hidden="true"><i /><i /><i /><i /></span>}
            <button type="button" className="jal-x" aria-label={ui("close", lang)} onClick={() => setGuideOn(false)}>×</button>
          </div>

          <p className="jal-line" lang={lang} aria-live="polite" key={`${active}-${lang}`}>
            {steps.length ? said : ui("scroll", lang)}
          </p>

          {steps.length > 1 && (
            <div className="jal-dots" role="tablist" aria-label="Parts of this page">
              {dots.map((i) => (
                <button key={i} type="button" role="tab" aria-selected={i === active} aria-label={`${i + 1}`}
                  className={i === active ? "on" : i < active ? "done" : ""} onClick={() => go(i)} />
              ))}
            </div>
          )}

          <div className="jal-controls">
            <button type="button" className="ghost" onClick={() => go(active - 1)} disabled={active <= 0}>← {ui("back", lang)}</button>
            {voice !== "none" && (
              <button type="button" className={`jal-play${voiceOn ? " on" : ""}`} aria-pressed={voiceOn} onClick={toggleVoice}>
                <SpeakerIcon off={voiceOn} /> {voiceOn ? ui("pause", lang) : ui("listen", lang)}
              </button>
            )}
            <button type="button" onClick={() => go(active + 1)} disabled={active >= steps.length - 1}>{ui("next", lang)} →</button>
          </div>

          <div className="jal-langs" role="group" aria-label={ui("language", lang)}>
            {LANGS.map((l) => (
              <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.native}</button>
            ))}
          </div>
        </aside>
      )}
    </>
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
