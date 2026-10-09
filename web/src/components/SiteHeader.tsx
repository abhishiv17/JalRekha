"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Brand";
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
  const on = (p: string) => (path?.startsWith(p) ? "page" : undefined);

  return (
    <>
      <div className="announce">
        {analysed && (
          <strong>
            {analysed.n} lakes analysed in {analysed.cities} {analysed.cities === 1 ? "city" : "cities"}
          </strong>
        )}
        {analysed && " · "}
        {catalogSize > 0 && <>{catalogSize.toLocaleString("en-IN")} lakes across India catalogued · </>}
        results as of 9 Oct 2026
      </div>
      <header className="site">
        <nav aria-label="Main">
          <Link href="/" className="brand" aria-label="JalRekha home"><Logo /></Link>
          <div className="nav-links">
            <Link className="link" href="/check/" aria-current={on("/check")}>Plot Check</Link>
            <Link className="link" href="/lakes/" aria-current={on("/lake")}>Lakes</Link>
            <Link className="link" href="/#how">How it works</Link>
            <Link className="link" href="/#method">Methodology</Link>
            <Link className="link" href="/watchlist/" aria-current={on("/watchlist")}>Watchlist</Link>
            <Link className="button" href="/lakes/" style={{ minHeight: 40, padding: "9px 16px", marginLeft: 6 }}>
              Explore lakes
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
