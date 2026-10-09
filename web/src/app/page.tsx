"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { Arrow } from "@/components/SiteHeader";
import { type Card, cards } from "@/lib/catalog";
import { type LakeSummary, loadIndex } from "@/lib/data";

const COLLAGE: { thumb: string; city: string; alt: string }[] = [
  { thumb: "/thumbs/hussain-sagar.jpg", city: "HYDERABAD", alt: "Hussain Sagar, Hyderabad" },
  { thumb: "/thumbs/subedeharana-kere.png", city: "BENGALURU", alt: "Subedeharana Kere, Bengaluru" },
  { thumb: "/thumbs/powai.jpg", city: "MUMBAI", alt: "Powai Lake, Mumbai" },
  { thumb: "/thumbs/kankaria.jpg", city: "AHMEDABAD", alt: "Kankaria Lake, Ahmedabad" },
  { thumb: "/thumbs/dal.jpg", city: "SRINAGAR", alt: "Dal Lake, Srinagar" },
  { thumb: "/thumbs/jakkur.png", city: "BENGALURU", alt: "Jakkur Lake, Bengaluru" },
  { thumb: "/thumbs/sukhna.jpg", city: "CHANDIGARH", alt: "Sukhna Lake, Chandigarh" },
  { thumb: "/thumbs/pallikaranai.jpg", city: "CHENNAI", alt: "Pallikaranai Marsh, Chennai" },
  { thumb: "/thumbs/yele-mallappa-shetty.png", city: "BENGALURU", alt: "Yele Mallappa Shetty Lake, Bengaluru" },
  { thumb: "/thumbs/rabindra-sarobar.jpg", city: "KOLKATA", alt: "Rabindra Sarobar, Kolkata" },
  { thumb: "/thumbs/upper-lake-bhopal.jpg", city: "BHOPAL", alt: "Upper Lake, Bhopal" },
  { thumb: "/thumbs/pattandur-agrahara.png", city: "BENGALURU", alt: "Pattandur Agrahara Lake, Bengaluru" },
  { thumb: "/thumbs/bhalswa.jpg", city: "DELHI", alt: "Bhalswa Lake, Delhi" },
  { thumb: "/thumbs/vellayani.jpg", city: "THIRUVANANTHAPURAM", alt: "Vellayani Lake, Thiruvananthapuram" },
  { thumb: "/thumbs/sadaramangala.png", city: "BENGALURU", alt: "Sadaramangala Lake, Bengaluru" },
  { thumb: "/thumbs/ambalipura-kelagina.png", city: "BENGALURU", alt: "Ambalipura Kelagina Kere, Bengaluru" },
];

// Eight columns of two tiles; tall/short alternate so every column ends level.
const COLUMNS = Array.from({ length: COLLAGE.length / 2 }, (_, i) => COLLAGE.slice(i * 2, i * 2 + 2));

// Scalloped edge: a row of half-circles across a 1440-wide strip.
const SCALLOP = (() => {
  let d = "M0 24 L0 12";
  for (let x = 0; x < 1440; x += 24) d += ` A12 12 0 0 1 ${x + 24} 12`;
  return d + " L1440 24 Z";
})();

function featured(all: Card[]): Card[] {
  const analysed = all.filter((c) => c.analysed);
  const pick = (id: string) => analysed.find((c) => c.id === id);
  const picks = [pick("subedeharana-kere"), pick("jakkur"), pick("sadaramangala")].filter(Boolean) as Card[];
  const queued = all.filter((c) => !c.analysed);
  const q = (name: string) => queued.find((c) => c.name === name);
  const others = [q("Hussain Sagar"), q("Powai Lake"), q("Dal Lake")].filter(Boolean) as Card[];
  // Interleave analysed and queued so the gallery reads as India-wide.
  return picks.flatMap((p, i) => [p, others[i]]).filter(Boolean).slice(0, 6);
}

export default function Home() {
  const [lakes, setLakes] = useState<LakeSummary[]>([]);
  const [catalogSize, setCatalogSize] = useState(0);
  useEffect(() => {
    loadIndex().then((i) => setLakes(i.lakes)).catch(() => setLakes([]));
    fetch("/catalog/meta.json").then((r) => r.json()).then((m) => setCatalogSize(m.lakes ?? 0)).catch(() => {});
  }, []);
  const all = useMemo(() => cards(lakes), [lakes]);
  const show = featured(all);
  const total = Math.max(catalogSize, all.length);

  return (
    <main className="home">
      <section className="wrap hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title">Seen.<br />Dated.<br />Filed.</h1>
          <p>
            KereWatch reads free Sentinel-2 imagery to show where India&apos;s lakes have been filled, built on or
            grassed over, dry season by dry season since 2019, and turns each change into a file a lake group can send.
          </p>
          <ul className="tags" aria-label="About the data">
            <li>SENTINEL-2</li><li>10 M PIXELS</li><li>SINCE 2019</li><li>OPEN DATA</li><li>BUILT ON AWS</li>
          </ul>
          <div className="row" style={{ gap: 12 }}>
            <Link href="/lakes/" className="button big">Explore lakes <Arrow /></Link>
            <Link href="#method" className="button big secondary">How it works</Link>
          </div>
        </div>
        <figure className="hero-figure" aria-label="Subedeharana Kere, Bengaluru, in the 2019 and 2026 dry seasons">
          <div className="hero-stack">
          <div className="shot back">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/thumbs/hero-subedeharana-2019.png" alt="Subedeharana Kere in the 2019 dry season, covered in algae" />
            <span className="label">DRY SEASON 2019</span>
          </div>
          <div className="shot front">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/thumbs/hero-subedeharana-2026.png" alt="Subedeharana Kere in the 2026 dry season, its western lobe outlined as changed" />
            <span className="label">DRY SEASON 2026</span>
          </div>
          </div>
          <figcaption className="hero-caption">
            <strong>0.94 ac</strong>
            <span><span className="flag-key" />lake bed now grassed land, Subedeharana Kere</span>
          </figcaption>
        </figure>
      </section>

      <section className="collage-band" aria-label="Lakes in the collection">
        <svg viewBox="0 0 1440 24" preserveAspectRatio="none" aria-hidden="true"><path d={SCALLOP} fill="#fff" /></svg>
        <div className="collage">
          {COLUMNS.map((col, i) => (
            <div className="collage-col" key={i}>
              {col.map((t, j) => (
                <figure key={t.thumb} style={{ flexGrow: (i + j) % 2 ? 2 : 3 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumb} alt={t.alt} loading="lazy" />
                  <figcaption>{t.city}</figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="wrap why" aria-labelledby="why-title">
        <div>
          <h2 id="why-title" className="section-title">Lakes are lost slowly, then all at once.</h2>
          <p className="lede" style={{ color: "var(--body)", maxWidth: 480 }}>
            Debris is dumped, mud laid over it, and the land settles for months before anything is built. By the time a
            survey or a flood notices, it&apos;s a building. KereWatch shows the slow part.
          </p>
        </div>
        <div className="big-stats">
          <div className="big-stat"><b>472 ac</b><p>of Bengaluru lake land identified as encroached by the city corporation</p></div>
          <div className="big-stat"><b style={{ color: "#c2410c" }}>17.38 ac</b><p>of it reclaimed</p></div>
          <p className="small muted" style={{ gridColumn: "span 2", margin: 0 }}>
            Source:{" "}
            <a href="https://sandrp.in/2026/02/10/bengaluru-lakes-2025-buffer-zone-amended-pollution-rising/">
              SANDRP, Bengaluru Lakes 2025
            </a>{" "}
            (Feb 2026), summarising The New Indian Express.
          </p>
        </div>
      </section>

      <section id="lakes" className="wrap" style={{ paddingTop: 64, paddingBottom: 32 }} aria-labelledby="lakes-title">
        <div className="section-head">
          <div>
            <h2 id="lakes-title" className="section-title">Lakes across India</h2>
            <p className="lede">Every named lake, tank and reservoir we can map, from OpenStreetMap. Same method for each: an outline, eight dry seasons, one evidence file.</p>
          </div>
          <Link href="/lakes/" className="button secondary">See all {total.toLocaleString("en-IN")} lakes <Arrow size={16} /></Link>
        </div>
        <div className="lake-grid wide">
          {show.map((c) => <LakeCard key={c.id} c={c} facts={false} />)}
        </div>
      </section>

      <section id="method" className="wrap" style={{ paddingTop: 96, paddingBottom: 48 }} aria-labelledby="method-title">
        <h2 id="method-title" className="section-title" style={{ maxWidth: 760, marginBottom: 40 }}>
          Dry season against dry season. Only change that stays.
        </h2>
        <ol className="steps">
          <li><span className="mono small muted">01</span><b>Read the sky</b>
            <span>Every clear Sentinel-2 pass, January to April, each year since 2019. Clouds and building shadows removed.</span></li>
          <li><span className="mono small muted">02</span><b>Tell weeds from land</b>
            <span>Hyacinth floats on water, so it reflects little shortwave infrared. Grass on filled ground reflects far more. Weeds stay lake.</span></li>
          <li><span className="mono small muted">03</span><b>Flag what stays</b>
            <span>Lake bed that turns to land and stays that way for two dry seasons, in patches of 500 m² or more, with a first-seen date.</span></li>
          <li><span className="mono small muted">04</span><b>Hand it over</b>
            <span>An evidence pack with images, acreage, coordinates and scene IDs anyone can re-check, plus draft complaint and RTI letters.</span></li>
        </ol>
      </section>

      <section id="evidence" className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }} aria-labelledby="evidence-title">
        <div className="evidence-band">
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            <h2 id="evidence-title">A file a lake group can send.</h2>
            <p>Phone photos and a letter are easy to dispute. Dated satellite scenes with acreage and coordinates are not, and any official can re-run them.</p>
            <div className="row" style={{ gap: 12 }}>
              <Link href="/lake/subedeharana-kere/evidence/" className="button">Open an evidence pack</Link>
              <Link href="/lakes/" className="button secondary">Watch a lake for new change</Link>
            </div>
          </div>
          <ul>
            <li><span>Before and after, same season</span><span>PNG</span></li>
            <li><span>Flag outlines and coordinates</span><span>GEOJSON</span></li>
            <li><span>Area by season, method, limits</span><span>PDF</span></li>
            <li><span>Satellite scene IDs</span><span>RE-CHECKABLE</span></li>
            <li><span>Draft complaint and RTI</span><span>TEXT</span></li>
          </ul>
        </div>
      </section>
    </main>
  );
}
