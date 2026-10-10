// Jal's voice. Amazon Polly's Indian voice (Kajal) reads English and Hindi through the Plot Check
// API; Kannada and Telugu, which Polly has no voice for, use the visitor's device voice when it
// has one. One sentence plays at a time.

import type { Lang } from "./lang";

const API = (process.env.NEXT_PUBLIC_PLOT_API_URL ?? "").trim().replace(/\/$/, "");
const POLLY: Lang[] = ["en", "hi"];
const BCP47: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", te: "te-IN" };

const links = new Map<string, string>();
let audio: HTMLAudioElement | null = null;
let token = 0;
let current: (() => void) | null = null; // tells whoever is speaking that they've stopped
let pollyDownUntil = 0;

export type Voice = "polly" | "device" | "none";

/** Only an Indian voice will do for Jal: no American or British stand-ins. */
function deviceVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const want = BCP47[lang].toLowerCase();
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace("_", "-") === want) ?? null;
}

/** Which voice Jal would use for this language right now. */
export function voiceFor(lang: Lang): Voice {
  if (API && POLLY.includes(lang) && Date.now() > pollyDownUntil) return "polly";
  return deviceVoice(lang) ? "device" : "none";
}

/** Device voices load late in some browsers; call back when they arrive. */
export function onVoices(fn: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", fn);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", fn);
}

export function stop() {
  token++;
  const done = current;
  current = null;
  done?.();
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function viaDevice(text: string, lang: Lang, done: () => void): boolean {
  const v = deviceVoice(lang);
  if (!v) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.95;
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Read text aloud. Resolves with the voice used ("none" if it can't be read here);
 * onDone fires when it finishes or is interrupted by the next call or stop().
 */
export async function speak(text: string, lang: Lang, onDone: () => void = () => {}): Promise<Voice> {
  stop();
  const mine = token;
  const finish = () => {
    if (mine !== token) return;
    current = null;
    onDone();
  };
  current = onDone;
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 900);
  if (!clean) {
    finish();
    return "none";
  }

  if (API && POLLY.includes(lang) && Date.now() > pollyDownUntil) {
    try {
      const key = `${lang}:${clean}`;
      let url = links.get(key);
      if (!url) {
        const r = await fetch(`${API}/speak`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang, text: clean }),
        });
        if (!r.ok) throw new Error(String(r.status));
        url = ((await r.json()) as { url: string }).url;
        links.set(key, url);
      }
      if (mine !== token) return "polly";
      const a = new Audio(url);
      audio = a;
      a.onended = finish;
      a.onerror = finish;
      try {
        await a.play();
      } catch {
        // The browser wants a tap before sound (autoplay rules); Polly itself is fine.
        finish();
        return "none";
      }
      return "polly";
    } catch {
      pollyDownUntil = Date.now() + 60_000;
      if (mine !== token) return "none";
    }
  }
  if (viaDevice(clean, lang, finish)) return "device";
  finish();
  return "none";
}
