"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, ui, useLang } from "@/lib/lang";

export default function LanguageMenu() {
  const { lang, setLang, pending } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="lang-menu" ref={box} data-no-translate>
      <button type="button" className={`lang-button${pending > 0 && lang !== "en" ? " busy" : ""}`} aria-haspopup="true"
        aria-expanded={open} onClick={() => setOpen((o) => !o)} title={ui("language", lang)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
        </svg>
        <span lang={current.id}>{current.short}</span>
      </button>
      {open && (
        <div className="lang-pop" role="menu" aria-label={ui("language", lang)}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" role="menuitemradio" aria-checked={l.id === lang} lang={l.id}
              onClick={() => {
                setLang(l.id);
                setOpen(false);
              }}>
              <b>{l.native}</b>
              {l.id !== "en" && <span>{l.english}</span>}
            </button>
          ))}
          <p>Translated by Amazon Translate. Lake and place names may stay in English.</p>
        </div>
      )}
      {pending > 0 && lang !== "en" && <span className="sr-only" role="status">{ui("translating", lang)}</span>}
    </div>
  );
}
