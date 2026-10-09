"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ANALYSED_META } from "@/lib/catalog";
import { loadIndex } from "@/lib/data";

export function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="8" fill="#121212" />
      <path d="M7 15c3-3 6-3 9 0s6 3 9 0" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 22c3-3 6-3 9 0s6 3 9 0" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="25" y="6" width="5" height="5" rx="1" fill="#F2683A" />
    </svg>
  );
}

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
  const on = (p: string) => (path === p || path === p.replace(/\/$/, "") ? "page" : undefined);
  return (
    <>
      <div className="announce">
        {analysed && (
          <strong>
            {analysed.n} lakes analysed in {analysed.cities} {analysed.cities === 1 ? "city" : "cities"}
          </strong>
        )}
        {catalogSize > 0 && <> · {catalogSize.toLocaleString("en-IN")} lakes across India catalogued</>} · results as of 9 Oct 2026
      </div>
      <header className="site">
        <nav aria-label="Main">
          <Link href="/" className="brand">
            <Logo />
            <span>
              <span className="brand-name">KereWatch</span>
              <span className="brand-sub">Lake evidence from space</span>
            </span>
          </Link>
          <div className="nav-links">
            <Link className="link" href="/lakes/" aria-current={on("/lakes/")}>All lakes</Link>
            <Link className="link" href="/#method">How it works</Link>
            <Link className="link" href="/#evidence">Evidence pack</Link>
            <Link className="pill-search" href="/lakes/"><SearchIcon />Search a lake</Link>
            <Link className="button" href="/lakes/" style={{ minHeight: 40, padding: "10px 16px", borderRadius: 8 }}>
              Watch a lake
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
