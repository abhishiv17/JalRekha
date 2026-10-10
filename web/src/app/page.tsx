"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { BhalswaStory } from "@/components/LakeStory";
import Jal, { Guide, type Mood } from "@/components/Mascot";
import { Arrow } from "@/components/SiteHeader";
import { cards } from "@/lib/catalog";
import { type LakeSummary, loadIndex } from "@/lib/data";

const COLLAGE: { thumb: string; city: string; alt: string }[] = [
  { thumb: "/thumbs/hussain-sagar.jpg", city: "HYDERABAD", alt: "Hussain Sagar, Hyderabad" },
  { thumb: "/thumbs/subedeharana-kere.png", city: "BENGALURU", alt: "Subedeharana Kere, Bengaluru" },
  { thumb: "/thumbs/powai.jpg", city: "MUMBAI", alt: "Powai Lake, Mumbai" },
  { thumb: "/thumbs/ameenpur.png", city: "HYDERABAD", alt: "Ameenpur Lake, Hyderabad" },
  { thumb: "/thumbs/dal.jpg", city: "SRINAGAR", alt: "Dal Lake, Srinagar" },
  { thumb: "/thumbs/jakkur.png", city: "BENGALURU", alt: "Jakkur Lake, Bengaluru" },
  { thumb: "/thumbs/sukhna.jpg", city: "CHANDIGARH", alt: "Sukhna Lake, Chandigarh" },
  { thumb: "/thumbs/chembarambakkam.jpg", city: "CHENNAI", alt: "Chembarambakkam Lake, Chennai" },
  { thumb: "/thumbs/bellandur.png", city: "BENGALURU", alt: "Bellandur Lake, Bengaluru" },
  { thumb: "/thumbs/rabindra-sarobar.jpg", city: "KOLKATA", alt: "Rabindra Sarobar, Kolkata" },
  { thumb: "/thumbs/upper-lake-bhopal.jpg", city: "BHOPAL", alt: "Upper Lake, Bhopal" },
  { thumb: "/thumbs/kankaria.jpg", city: "AHMEDABAD", alt: "Kankaria Lake, Ahmedabad" },
  { thumb: "/thumbs/durgam-cheruvu.png", city: "HYDERABAD", alt: "Durgam Cheruvu, Hyderabad" },
  { thumb: "/thumbs/vellayani.jpg", city: "THIRUVANANTHAPURAM", alt: "Vellayani Lake, Thiruvananthapuram" },
  { thumb: "/thumbs/varthur.png", city: "BENGALURU", alt: "Varthur Lake, Bengaluru" },
  { thumb: "/thumbs/bhalswa.jpg", city: "DELHI", alt: "Bhalswa Lake, Delhi" },
];
const COLUMNS = Array.from({ length: COLLAGE.length / 2 }, (_, i) => COLLAGE.slice(i * 2, i * 2 + 2));

const SCALLOP = (() => {
  let d = "M0 24 L0 12";
  for (let x = 0; x < 1440; x += 24) d += ` A12 12 0 0 1 ${x + 24} 12`;
  return d + " L1440 24 Z";
})();

// Real Plot Check results (stored by the Plot Check API), one per level.
const EXAMPLES: { id: string; place: string; level: "high" | "watch" | "low"; label: string; mood: Mood; why: string }[] = [
  {
    id: "28.7471_77.1774", place: "Edge of Bhalswa Lake, Delhi", level: "high", label: "High risk", mood: "worried",
    why: "Lake water stood here in 6 of 8 years. This is probably old lake bed.",
  },
  {
    id: "28.5536_77.1952", place: "Hauz Khas Village, Delhi", level: "watch", label: "Be careful", mood: "cautious",
    why: "Hauz Khas Lake comes within 67 metres. The spot itself stayed dry every year.",
  },
  {
    id: "28.7462_77.1676", place: "West of Bhalswa Lake, Delhi", level: "low", label: "Low risk", mood: "celebrate",
    why: "Dry in every satellite photo since 2019. The lake is 277 metres away.",
  },
];

export default function Home() {
  const [lakes, setLakes] = useState<LakeSummary[]>([]);
  const [catalogSize, setCatalogSize] = useState(0);
  useEffect(() => {
    loadIndex().then((i) => setLakes(i.lakes)).catch(() => setLakes([]));
    fetch("/catalog/meta.json").then((r) => r.json()).then((m) => setCatalogSize(m.lakes ?? 0)).catch(() => {});
  }, []);
  const analysed = useMemo(
    () => cards(lakes).filter((c) => c.analysed).sort((a, b) => (b.flaggedAc ?? 0) - (a.flaggedAc ?? 0)),
    [lakes],
  );
  // Delhi lakes first, most lake lost first.
  const preview = [
    ...analysed.filter((c) => c.city === "Delhi"),
    ...analysed.filter((c) => c.city !== "Delhi"),
  ].slice(0, 3);

  return (
    <main className="home">
      {/* Hero: the one question we answer */}
      <section className="wrap hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">Satellite proof · free · anywhere in India</span>
          <h1 id="hero-title" className="hero-title">Lakes protect our cities. <em>Let&rsquo;s protect lakes.</em></h1>
          <p>
            Lakes soak up the rain that would flood our streets, and refill our borewells. But they are being filled in,
            quietly, one plot at a time. JalRekha uses satellite photos to show where, so people and cities can stop it.
          </p>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <Link href="/check/" className="button big">Check a plot <Arrow /></Link>
            <Link href="/lakes/" className="button big secondary">See lakes we watch</Link>
          </div>
          <ul className="tags" aria-label="Languages">
            <li>ENGLISH</li><li lang="kn">ಕನ್ನಡ</li><li lang="te">తెలుగు</li><li lang="hi">हिंदी</li><li>BUILT ON AWS</li>
          </ul>
        </div>
        <figure className="hero-figure" aria-label="Bhalswa Lake, Delhi, in 2019 and 2026">
          <div className="hero-stack">
            <div className="shot back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/thumbs/hero-bhalswa-2019.jpg" alt="Bhalswa Lake, Delhi, in 2019, with the lake outline" />
              <span className="label">2019</span>
            </div>
            <div className="shot front">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/thumbs/hero-bhalswa-2026.jpg" alt="Bhalswa Lake, Delhi, in 2026, with the lake bed turned to land outlined in orange" />
              <span className="label">2026</span>
            </div>
          </div>
          <figcaption>
            <Guide size={60}>
              <span className="hero-caption">
                <strong>8 acres</strong>
                <span>
                  <span className="flag-key" />of Delhi&rsquo;s Bhalswa Lake turned into land since 2019, mostly soil pushed in at
                  its north-east edge. Spotted from space, dated, ready to check. <Link href="/lake/bhalswa/">See it</Link>
                </span>
              </span>
            </Guide>
          </figcaption>
        </figure>
      </section>

      {/* Who it helps */}
      <section id="who" className="wrap section" aria-labelledby="who-title">
        <span className="eyebrow">Who it helps</span>
        <h2 id="who-title" className="section-title" style={{ marginBottom: 24 }}>Everyone can help save a lake.</h2>
        <div className="reasons">
          <div className="reason">
            <h3>Home buyers</h3>
            <p>Check a plot before you pay. When people stop buying land that was a lake, filling lakes stops paying.</p>
            <Link href="/check/">Check a plot →</Link>
          </div>
          <div className="reason">
            <h3>Citizens and lake groups</h3>
            <p>Catch a lake being filled in early. Get dated satellite photos and a ready letter to report it.</p>
            <Link href="/lakes/">See lakes →</Link>
          </div>
          <div className="reason">
            <h3>Cities and government</h3>
            <p>See which lakes are shrinking and where floods hit, so you can protect, restore and fix drains before the monsoon.</p>
            <Link href="#how">How it works →</Link>
          </div>
        </div>
      </section>

      {/* How it works: a scroll story on one real lake */}
      <section id="how" className="wrap section" aria-labelledby="how-title">
        <span className="eyebrow">How it works</span>
        <h2 id="how-title" className="section-title" style={{ marginBottom: 8 }}>Watch it work on a real Delhi lake.</h2>
        <p className="lede" style={{ maxWidth: 680, marginBottom: 28 }}>
          Scroll down. Each step adds one layer to the real satellite photo of Bhalswa Lake.
        </p>
        <BhalswaStory />
      </section>

      {/* Real results */}
      <section id="examples" className="wrap section" aria-labelledby="examples-title">
        <span className="eyebrow">Real results</span>
        <h2 id="examples-title" className="section-title" style={{ marginBottom: 24 }}>What an answer looks like.</h2>
        <div className="examples">
          {EXAMPLES.map((e) => (
            <Link key={e.id} href={`/check/?id=${e.id}`} className={`example example-${e.level}`}>
              <Jal size={56} mood={e.mood} interactive={false} />
              <span>
                <span className={`pill level-${e.level}`}>{e.label}</span>
                <b>{e.place}</b>
                <span className="small">{e.why}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why it matters */}
      <section id="why" className="wrap section" aria-labelledby="why-title">
        <span className="eyebrow">Why it matters</span>
        <h2 id="why-title" className="section-title" style={{ marginBottom: 12 }}>Lakes are a city&rsquo;s free flood protection.</h2>
        <p className="lede" style={{ maxWidth: 720, marginBottom: 24 }}>
          A healthy lake holds the rain and refills the ground. When it is filled in, that rain has nowhere to go but into
          homes. Keeping lakes alive is the cheapest way to fewer floods and fuller borewells.
        </p>
        <div className="big-stats why-stats">
          <div className="big-stat">
            <b>472 acres</b>
            <p>of Bengaluru lake land taken over. Only 17 acres won back. <a href="https://sandrp.in/2026/02/10/bengaluru-lakes-2025-buffer-zone-amended-pollution-rising/">SANDRP, 2026</a></p>
          </div>
          <div className="big-stat">
            <b>Sept 2022</b>
            <p>Overflowing lakes and blocked drains flooded Bengaluru&rsquo;s tech parks and homes. <a href="https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Frain-brings-bengalurus-it-corridor-to-a-standstill-1142546.html">Deccan Herald</a></p>
          </div>
          <div className="big-stat">
            <b>Half</b>
            <p>of Bengaluru&rsquo;s borewells dried up in March 2024. <a href="https://www.newslaundry.com/2024/03/20/over-exploited-groundwater-neglected-lakes-heres-why-bengaluru-is-facing-a-water-crisis">IndiaSpend</a></p>
          </div>
        </div>
      </section>

      <section className="collage-band" aria-label="Lakes in the catalogue, seen from space">
        <svg className="scallop" viewBox="0 0 1440 24" preserveAspectRatio="none" aria-hidden="true"><path d={SCALLOP} fill="var(--bg)" /></svg>
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

      {/* Lakes we watch */}
      <section id="lakes" className="wrap section" aria-labelledby="lakes-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">Lakes we watch</span>
            <h2 id="lakes-title" className="section-title">Watch a lake. Get told if it shrinks.</h2>
            <p className="lede">
              We track {analysed.length || 12} lakes closely and email you the moment one starts to shrink.
              {catalogSize > 0 && <> {catalogSize.toLocaleString("en-IN")} lakes across India are on the map.</>}
            </p>
          </div>
          <Link href="/lakes/" className="button secondary">See all lakes <Arrow size={16} /></Link>
        </div>
        <div className="lake-grid">{preview.map((c) => <LakeCard key={c.id} c={c} facts={false} />)}</div>
      </section>

      {/* How sure is this? */}
      <section id="method" className="wrap section" aria-labelledby="method-title">
        <span className="eyebrow">How sure is this?</span>
        <h2 id="method-title" className="section-title" style={{ marginBottom: 20 }}>Strong early warning. Then verify on the ground.</h2>
        <ul className="plain-list">
          <li><b>What we see:</b> where water was, each year since 2019, from photos 10 metres sharp.</li>
          <li><b>What we don&rsquo;t:</b> the legal lake boundary, small walls or sheds, or floods hidden between tall buildings.</li>
          <li><b>Clouds:</b> if a season is too cloudy, we say &ldquo;not sure&rdquo; instead of guessing.</li>
          <li><b>Before you act:</b> check the official lake map and ask a lawyer. We tell you what to ask.</li>
        </ul>
      </section>

      <section id="credits" className="wrap section" style={{ paddingBottom: 96 }} aria-label="Data sources">
        <p className="small muted">
          Data: Copernicus Sentinel-1 and Sentinel-2 (2019–2026) via the{" "}
          <a href="https://registry.opendata.aws/sentinel-2-l2a-cogs/">Registry of Open Data on AWS</a> and{" "}
          <a href="https://github.com/element84/earth-search">Earth Search</a>; lake outlines from{" "}
          <a href="https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area">ATREE-CSEI</a> (CC BY)
          and © OpenStreetMap contributors (ODbL). Runs on AWS: Lambda, S3, DynamoDB, Amazon Location, Amazon Translate, CodeBuild.
        </p>
      </section>
    </main>
  );
}
