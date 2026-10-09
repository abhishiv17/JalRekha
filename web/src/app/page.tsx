"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import Jal from "@/components/Mascot";
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
  const preview = [
    ...analysed.filter((c) => c.id === "subedeharana-kere"),
    ...analysed.filter((c) => c.id !== "subedeharana-kere"),
  ].slice(0, 6);

  return (
    <main className="home">
      {/* Hero */}
      <section className="wrap hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <Jal size={84} />
          <span className="eyebrow">Public lake monitoring</span>
          <h1 id="hero-title" className="hero-title">See how our lakes <em>change</em> over time.</h1>
          <p>
            Explore historical satellite imagery, examine persistent changes in lake beds and surrounding buffer zones,
            and access reproducible evidence to support lake conservation.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link href="/lakes/" className="button big">Explore monitored lakes <Arrow /></Link>
            <Link href="#how" className="button big secondary">How it works</Link>
          </div>
          <ul className="tags" aria-label="About the data">
            <li>SENTINEL-2 L2A</li><li>10 M PIXELS</li><li>DRY SEASONS 2019–2026</li><li>OPEN DATA</li><li>BUILT ON AWS</li>
          </ul>
        </div>
        <figure className="hero-figure" aria-label="Subedeharana Kere, Bengaluru, in the 2019 and 2026 dry seasons">
          <div className="hero-stack">
            <div className="shot back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/thumbs/hero-subedeharana-2019.png" alt="Subedeharana Kere in the 2019 dry season, with the lake outline" />
              <span className="label">DRY SEASON 2019</span>
            </div>
            <div className="shot front">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/thumbs/hero-subedeharana-2026.png" alt="Subedeharana Kere in the 2026 dry season, with the detected change outlined in amber" />
              <span className="label">DRY SEASON 2026</span>
            </div>
          </div>
          <figcaption className="hero-caption">
            <strong>0.94 ac</strong>
            <span>
              <span className="flag-key" />of Subedeharana Kere&apos;s bed has turned to grassed land, lasting since the
              2025 dry season. Real pipeline output; field check pending. <Link href="/lake/subedeharana-kere/">Open this lake</Link>
            </span>
          </figcaption>
        </figure>
      </section>

      <section className="collage-band" aria-label="Lakes in the catalogue, as seen by Sentinel-2">
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

      {/* A. The problem */}
      <section id="problem" className="wrap section split" aria-labelledby="problem-title">
        <div>
          <span className="eyebrow">The problem</span>
          <h2 id="problem-title" className="section-title">Lakes are lost slowly, then all at once.</h2>
          <p className="lede" style={{ marginBottom: 14 }}>
            Debris is dumped at the edge, mud is laid over it and the land is compressed for months before anything is
            built. Each step takes space that monsoon floodwater and groundwater recharge depend on.
          </p>
          <p className="lede">
            By the time a survey or a flood notices, the change is years old and its date is disputed. Lake groups need
            evidence that is <strong>dated</strong>, <strong>public</strong> and <strong>reproducible</strong>, early enough to act.
          </p>
        </div>
        <div className="big-stats">
          <div className="big-stat"><b>472 ac</b><p>of Bengaluru lake land identified as encroached by the city corporation</p></div>
          <div className="big-stat"><b style={{ color: "var(--amber-ink)" }}>17.38 ac</b><p>of it reclaimed</p></div>
          <p className="small muted" style={{ margin: 0 }}>
            Source: <a href="https://sandrp.in/2026/02/10/bengaluru-lakes-2025-buffer-zone-amended-pollution-rising/">SANDRP, Bengaluru Lakes 2025</a> (Feb 2026), summarising The New Indian Express.
          </p>
        </div>
      </section>

      {/* B. How it works */}
      <section id="how" className="wrap section" aria-labelledby="how-title">
        <span className="eyebrow">How JalRekha works</span>
        <h2 id="how-title" className="section-title" style={{ maxWidth: 780, marginBottom: 36 }}>
          Dry season against dry season. Only change that stays.
        </h2>
        <ol className="process">
          <li><b>Retrieve</b><span>Every Sentinel-2 Level-2A pass over the lake, read from the AWS Open Data registry.</span></li>
          <li><b>Mask</b><span>Drop clouds, cloud shadows and building shadows; a season needs 3+ clear looks per pixel.</span></li>
          <li><b>Compare seasons</b><span>A median for January–April each year, 2019–2026, so a dry summer isn&apos;t read as loss.</span></li>
          <li><b>Classify</b><span>Water, floating vegetation (still lake), land vegetation, bare or built, mixed.</span></li>
          <li><b>Persist and filter</b><span>Lake bed that turns to land for two dry seasons running, in patches of 500 m² or more.</span></li>
          <li><b>Show and export</b><span>Flags on the map, dated before/after images and a downloadable evidence pack.</span></li>
        </ol>
        <p className="small muted" style={{ marginTop: 18 }}>
          Runs on AWS: a Lambda container per lake (about two minutes), Step Functions across lakes, results in S3 and
          DynamoDB, a monthly EventBridge re-scan and SNS email alerts.
        </p>
      </section>

      {/* C. Explore monitored lakes */}
      <section id="lakes" className="wrap section" aria-labelledby="lakes-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">Explore monitored lakes</span>
            <h2 id="lakes-title" className="section-title">
              {analysed.length || 12} lakes analysed in three cities
            </h2>
            <p className="lede">
              Analysed lakes have results from the full pipeline.{" "}
              {catalogSize > 0 && <>Another {(catalogSize - analysed.length).toLocaleString("en-IN")} named lakes across India are catalogued and queued, with no results yet.</>}
            </p>
          </div>
          <Link href="/lakes/" className="button secondary">See all lakes <Arrow size={16} /></Link>
        </div>
        <div className="lake-grid">{preview.map((c) => <LakeCard key={c.id} c={c} facts={false} />)}</div>
      </section>

      {/* D. From observation to evidence */}
      <section id="evidence" className="section" aria-labelledby="evidence-title">
        <div className="band" style={{ padding: "64px 0" }}>
          <div className="wrap">
            <span className="eyebrow">From satellite observation to evidence</span>
            <h2 id="evidence-title" className="section-title" style={{ maxWidth: 760 }}>Four steps from a lake to a file you can send.</h2>
            <div className="flow" style={{ marginTop: 28 }}>
              <div className="flow-step">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="flow-img"><img src="/thumbs/ameenpur.png" alt="Ameenpur Lake with change flags" /></div>
                <div className="text"><b>1 · Pick a lake</b><span>Search the catalogue or the India map; analysed lakes open their results.</span></div>
              </div>
              <div className="flow-step">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="flow-img"><img src="/thumbs/hero-subedeharana-2019.png" alt="Subedeharana Kere, 2019 dry season" /></div>
                <div className="text"><b>2 · Compare years</b><span>Step through eight dry seasons and swipe any two side by side.</span></div>
              </div>
              <div className="flow-step">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="flow-img"><img src="/thumbs/hero-subedeharana-2026.png" alt="Subedeharana Kere, 2026 dry season, change outlined" /></div>
                <div className="text"><b>3 · Inspect a change</b><span>Each flag has an area, a first-seen season, its persistence and a category.</span></div>
              </div>
              <div className="flow-step">
                <div className="flow-img" style={{ display: "grid", placeItems: "center", padding: 20 }}>
                  <ul className="tags" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                    <li>EVIDENCE PACK · PDF</li><li>FLAGS · GEOJSON</li><li>FLAGS · KML</li><li>COMPLAINT + RTI DRAFTS</li>
                  </ul>
                </div>
                <div className="text"><b>4 · Export evidence</b><span>Dated images, areas, coordinates and scene IDs anyone can re-check.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E. Why it matters */}
      <section id="why" className="wrap section" aria-labelledby="why-title">
        <span className="eyebrow">Why it matters</span>
        <h2 id="why-title" className="section-title" style={{ marginBottom: 28 }}>Lakes are how a city holds water.</h2>
        <div className="reasons">
          <div className="reason">
            <h3>Floodwater storage</h3>
            <p>Lakes and their buffers take monsoon overflow. In September 2022, overflowing lakes and encroached drains flooded Bengaluru&apos;s IT corridor.</p>
            <p className="src"><a href="https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Frain-brings-bengalurus-it-corridor-to-a-standstill-1142546.html">Deccan Herald, Sep 2022</a></p>
          </div>
          <div className="reason">
            <h3>Groundwater recharge</h3>
            <p>In March 2024 about half of Bengaluru&apos;s borewells dried up; recharge from green spaces and water bodies is a fraction of daily use.</p>
            <p className="src"><a href="https://www.newslaundry.com/2024/03/20/over-exploited-groundwater-neglected-lakes-heres-why-bengaluru-is-facing-a-water-crisis">IndiaSpend via Newslaundry, Mar 2024</a></p>
          </div>
          <div className="reason">
            <h3>Citizen action</h3>
            <p>Surveys of the same lake disagree: for Bellandur, 16 acres encroached by one count, at least 36 by another. Dated satellite evidence gives lake groups a shared record.</p>
            <p className="src"><a href="https://www.deccanherald.com/india/karnataka/bengaluru/confusion-over-extent-lake-encroachment-2002391">Deccan Herald</a></p>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>
          JalRekha measures change in lake beds and buffers. It does not measure flood reduction or groundwater levels.
        </p>
      </section>

      {/* F. Methodology and limitations */}
      <section id="method" className="wrap section" aria-labelledby="method-title">
        <span className="eyebrow">Methodology and limitations</span>
        <h2 id="method-title" className="section-title" style={{ marginBottom: 24 }}>What the numbers mean, and what they don&apos;t.</h2>
        <dl className="limits">
          <div><dt>Observation period</dt><dd>Sentinel-2 Level-2A, January–April each year 2019–2026; November–December composites used to grade confidence.</dd></div>
          <div><dt>Baseline</dt><dd>2019–2020 dry seasons. Losses before 2019 are out of scope.</dd></div>
          <div><dt>Resolution</dt><dd>10 m pixels. A flag is at least 5 connected pixels (500 m²); small sheds and walls are missed.</dd></div>
          <div><dt>Persistence</dt><dd>Land in two dry seasons in a row is &ldquo;confirmed&rdquo;; one season is &ldquo;new&rdquo;. Water returning resets it.</dd></div>
          <div><dt>Weeds versus land</dt><dd>Vegetation floating on water reflects little shortwave infrared; grass on filled ground reflects much more. Weeds stay lake.</dd></div>
          <div><dt>Data quality</dt><dd>Fewer than 3 clear looks in a season means &ldquo;not enough data&rdquo;, never a guess.</dd></div>
          <div><dt>Not a land survey</dt><dd>Change is measured against the lake&apos;s historical water extent, not the revenue boundary. Legal works also show as change.</dd></div>
          <div><dt>Verification</dt><dd>Every flag needs checking against high-resolution imagery, on the ground and in official records.</dd></div>
        </dl>
        <div className="mascot-note" style={{ marginTop: 24 }}>
          <Jal size={64} />
          <p><strong>Satellite-detected change is not proof of illegal encroachment.</strong> Verify on the ground and in official records.</p>
        </div>
      </section>

      {/* G. Data sources and credits */}
      <section id="credits" className="wrap section" style={{ paddingBottom: 96 }} aria-labelledby="credits-title">
        <span className="eyebrow">Data sources and credits</span>
        <h2 id="credits-title" className="section-title" style={{ marginBottom: 24 }}>Open data, credited.</h2>
        <div className="credits">
          <div><b>Copernicus Sentinel-2</b>Contains modified Copernicus Sentinel data (2019–2026). Level-2A COGs from the <a href="https://registry.opendata.aws/sentinel-2-l2a-cogs/">Registry of Open Data on AWS</a>, found through <a href="https://github.com/element84/earth-search">Earth Search</a> by Element 84.</div>
          <div><b>ATREE-CSEI lake outlines</b><a href="https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area">Map of Lakes in Bengaluru Urban</a>, CC BY, via OpenCity.</div>
          <div><b>OpenStreetMap</b>Lake outlines across India and the basemap. © OpenStreetMap contributors, ODbL.</div>
          <div><b>News and reports</b>Used to choose and check lakes, cited where used and never copied.</div>
        </div>
      </section>
    </main>
  );
}
