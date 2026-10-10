"use client";

// The visitor's language and whether Jal is guiding them, shared by the header, the page
// translator, the speech bubbles and the Jal narrator. Both are remembered in this browser.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "en" | "hi" | "kn" | "te";

export const LANGS: { id: Lang; native: string; english: string; short: string }[] = [
  { id: "en", native: "English", english: "English", short: "EN" },
  { id: "hi", native: "हिन्दी", english: "Hindi", short: "हि" },
  { id: "kn", native: "ಕನ್ನಡ", english: "Kannada", short: "ಕ" },
  { id: "te", native: "తెలుగు", english: "Telugu", short: "తె" },
];

/** The few words on Jal's own controls, written out so they work before anything is translated. */
export const UI: Record<string, Record<Lang, string>> = {
  guide: { en: "Jal guide", hi: "जल गाइड", kn: "ಜಲ ಮಾರ್ಗದರ್ಶಿ", te: "జల గైడ్" },
  switching: {
    en: "Changing the language…",
    hi: "पेज हिन्दी में बदल रहा है…",
    kn: "ಪುಟವನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗುತ್ತಿದೆ…",
    te: "పేజీని తెలుగులోకి మారుస్తున్నాం…",
  },
  next: { en: "Next", hi: "आगे", kn: "ಮುಂದೆ", te: "తర్వాత" },
  back: { en: "Back", hi: "पीछे", kn: "ಹಿಂದೆ", te: "వెనుకకు" },
  listen: { en: "Listen", hi: "सुनें", kn: "ಕೇಳಿ", te: "వినండి" },
  pause: { en: "Pause", hi: "रोकें", kn: "ನಿಲ್ಲಿಸಿ", te: "ఆపండి" },
  close: { en: "Close", hi: "बंद करें", kn: "ಮುಚ್ಚಿ", te: "మూసివేయండి" },
  step: { en: "Step", hi: "चरण", kn: "ಹಂತ", te: "దశ" },
  scroll: {
    en: "Scroll down and I'll explain each part of this page as you reach it.",
    hi: "नीचे स्क्रॉल करें, मैं इस पेज का हर हिस्सा समझाता चलूँगा।",
    kn: "ಕೆಳಗೆ ಸ್ಕ್ರಾಲ್ ಮಾಡಿ, ಈ ಪುಟದ ಪ್ರತಿಯೊಂದು ಭಾಗವನ್ನು ನಾನು ವಿವರಿಸುತ್ತೇನೆ.",
    te: "కిందికి స్క్రోల్ చేయండి, ఈ పేజీలోని ప్రతి భాగాన్ని నేను వివరిస్తాను.",
  },
  language: { en: "Language", hi: "भाषा", kn: "ಭಾಷೆ", te: "భాష" },
  translating: { en: "Translating…", hi: "अनुवाद हो रहा है…", kn: "ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ…", te: "అనువదిస్తోంది…" },
  noVoice: {
    en: "This device has no voice for this language, so read along below.",
    hi: "इस डिवाइस पर इस भाषा की आवाज़ नहीं है, इसलिए नीचे पढ़ें।",
    kn: "ಈ ಸಾಧನದಲ್ಲಿ ಈ ಭಾಷೆಯ ಧ್ವನಿ ಇಲ್ಲ, ಆದ್ದರಿಂದ ಕೆಳಗೆ ಓದಿ.",
    te: "ఈ పరికరంలో ఈ భాషకు గొంతు లేదు, కాబట్టి కింద చదవండి.",
  },
  readIn: { en: "Read this in", hi: "इसे पढ़ें", kn: "ಇದನ್ನು ಓದಿ", te: "దీన్ని చదవండి" },
  walk: { en: "Let Jal walk you through", hi: "जल के साथ पूरा पेज समझें", kn: "ಜಲ ಜೊತೆ ಪುಟವನ್ನು ತಿಳಿಯಿರಿ", te: "జలతో పేజీని తెలుసుకోండి" },
  unavailable: {
    en: "Translation isn't available right now, so this page is in English.",
    hi: "अभी अनुवाद उपलब्ध नहीं है, इसलिए यह पेज अंग्रेज़ी में है।",
    kn: "ಈಗ ಅನುವಾದ ಲಭ್ಯವಿಲ್ಲ, ಆದ್ದರಿಂದ ಈ ಪುಟ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ.",
    te: "ప్రస్తుతం అనువాదం అందుబాటులో లేదు, అందుకే ఈ పేజీ ఇంగ్లీష్‌లో ఉంది.",
  },
  toEnglish: { en: "Back to English", hi: "अंग्रेज़ी में देखें", kn: "ಇಂಗ್ಲಿಷ್‌ಗೆ ಹಿಂತಿರುಗಿ", te: "ఇంగ్లీష్‌కి తిరిగి వెళ్ళండి" },
  hear: { en: "Hear Jal say this", hi: "जल से सुनें", kn: "ಜಲ ಹೇಳುವುದನ್ನು ಕೇಳಿ", te: "జల చెప్పేది వినండి" },
};

type LangState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  guideOn: boolean;
  setGuideOn: (on: boolean) => void;
  pending: number; // strings waiting for a translation
  setPending: (n: number) => void;
};

const Ctx = createContext<LangState | null>(null);
const KEY_LANG = "jalrekha.lang";
const KEY_GUIDE = "jalrekha.guide";

/** ?guide=1 opens the page with Jal already guiding: handy for sharing and demos. */
const urlGuide = (search: string) => new URLSearchParams(search).get("guide") === "1";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [guideOn, setGuideState] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("lang");
    const saved = (url ?? read(KEY_LANG)) as Lang | null;
    if (saved && LANGS.some((l) => l.id === saved)) setLangState(saved);
    if (urlGuide(window.location.search) || read(KEY_GUIDE) === "on") setGuideState(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    write(KEY_LANG, l);
  }, []);
  const setGuideOn = useCallback((on: boolean) => {
    setGuideState(on);
    write(KEY_GUIDE, on ? "on" : "off");
  }, []);

  const value = useMemo(() => ({ lang, setLang, guideOn, setGuideOn, pending, setPending }),
    [lang, setLang, guideOn, setGuideOn, pending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLang outside LangProvider");
  return v;
}

/** useLang for components that may also render outside the provider (printed reports). */
export function useLangMaybe(): LangState | null {
  return useContext(Ctx);
}

export const ui = (key: keyof typeof UI, lang: Lang) => UI[key][lang];
