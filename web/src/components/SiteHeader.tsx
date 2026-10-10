"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Brand";
import LanguageMenu from "@/components/LanguageMenu";
import { ANALYSED_META } from "@/lib/catalog";
import { loadIndex } from "@/lib/data";

export function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export default function SiteHeader() {
  const path = usePathname();
  const [catalogSize, setCatalogSize] = useState(0);
  const [analysed, setAnalysed] = useState<{ n: number; cities: number } | null>(null);
  useEffect(() => {
    fetch("/catalog/meta.json").then((r) => r.json()).then((m) => setCatalogSize(m.lakes ?? 0)).catch(() => {});
    loadIndex()
      .then((i) => {
        const cities = new Set(i.lakes.map((l) => ANALYSED_META[l.id]?.city ?? l.id));
        setAnalysed({ n: i.lakes.length, cities: cities.size });
      })
      .catch(() => {});
  }, []);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const on = (p: string) => (path?.startsWith(p) ? "page" : undefined);

  return (
    <>
      <div className="announce">
        {analysed && (
          <strong>
            {analysed.n} lakes tracked in {analysed.cities} {analysed.cities === 1 ? "city" : "cities"}
          </strong>
        )}
        {analysed && " · "}
        {catalogSize > 0 && <>{catalogSize.toLocaleString("en-IN")} lakes across India on the map · </>}
        updated 10 Oct 2026
      </div>
      <header className="site">
        <nav aria-label="Main">
          <Link href="/" className="brand" aria-label="JalRekha home" translate="no"><Logo /></Link>
          <div className="nav-tools">
            <LanguageMenu />
          </div>
          <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="main-links" onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Menu"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <div id="main-links" className={`nav-links${open ? " open" : ""}`}>
            <Link className="link" href="/lakes/" aria-current={on("/lake")}>Lakes</Link>
            <Link className="link" href="/ponds/" aria-current={on("/ponds")}>Missing ponds</Link>
            <Link className="link" href="/#how">How it works</Link>
            <Link className="link" href="/how-sure/" aria-current={on("/how-sure")}>How sure is it?</Link>
            <Link className="link" href="/watchlist/" aria-current={on("/watchlist")}>Watchlist</Link>
            <Link className="button" href="/check/" style={{ minHeight: 40, padding: "9px 16px", marginLeft: 6 }}>
              Check a plot
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
