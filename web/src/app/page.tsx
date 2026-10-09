"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { Guide } from "@/components/Mascot";
import { Arrow, SearchIcon } from "@/components/SiteHeader";
import { cards, statusOf } from "@/lib/catalog";
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

// Every flag the pipeline raised on the analysed lakes, checked against high-resolution
// historical photos (research/flags_checked.csv, 9 Oct 2026).
const LEDGER = { total: 44, confirmed: 13, notConfirmed: 21, unsure: 10, byPerson: 11, byAi: 33 };

function Icon({ d }: { d: string }) {
  return (
    <span className="icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const [lakes, setLakes] = useState<LakeSummary[]>([]);
  const [catalogSize, setCatalogSize] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => {
    loadIndex().then((i) => setLakes(i.lakes)).catch(() => setLakes([]));
    fetch("/catalog/meta.json").then((r) => r.json()).then((m) => setCatalogSize(m.lakes ?? 0)).catch(() => {});
  }, []);
  const analysed = useMemo(
    () => cards(lakes).filter((c) => c.analysed).sort((a, b) => (b.flaggedAc ?? 0) - (a.flaggedAc ?? 0)),
    [lakes],
  );
  const changed = analysed.filter((c) => statusOf(c).key === "changed");
  const steady = analysed.filter((c) => statusOf(c).key === "nochange");
  const subede = analysed.find((c) => c.id === "subedeharana-kere");
  const preview = [
    ...analysed.filter((c) => c.id === "subedeharana-kere" || c.id === "mallathahalli"),
    ...analysed.filter((c) => c.id !== "subedeharana-kere" && c.id !== "mallathahalli"),
  ].slice(0, 6);
  const search = (e: FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/lakes/?q=${encodeURIComponent(q.trim())}` : "/lakes/");
  };
  const pct = (n: number) => `${(n / LEDGER.total) * 100}%`;

  return (
    <main className="home">
      {/* Hero: the one question a resident has */}
      <section className="ripples" aria-labelledby="hero-title">
        <div className="wrap hero">
          <div className="hero-copy">
            <span className="kicker">For everyone who lives beside a lake</span>
            <h1 id="hero-title" className="hero-title">Is your lake being <em>filled in</em>?</h1>
            <p>
              Lakes rarely vanish overnight. Debris goes in at the edge, soil goes over it, and a few summers later the
              shoreline has moved. JalRekha compares satellite photos of every summer since 2019 and tells you, in plain
              words, whether your lake has lost ground, where, and since when.
            </p>
            <form className="hero-search" role="search" onSubmit={search}>
              <label htmlFor="hero-q" className="sr-only">Lake, area or city</label>
              <div className="search-pill">
                <SearchIcon />
                <input id="hero-q" type="search" placeholder="Your lake or area, e.g. Mallathahalli" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button type="submit" className="button big">Check it <Arrow /></button>
            </form>
            <div className="row" style={{ gap: 16 }}>
              <Link href="/lakes/?near=1" className="near-me">Show lakes near me</Link>
              <Link href="/lake/subedeharana-kere/" className="near-me">See a real example</Link>
            </div>
            <ul className="tags" aria-label="What you get">
              <li>FREE, NO SIGN-UP</li><li>EVERY SUMMER SINCE 2019</li><li>COMPLAINT + RTI DRAFTS</li><li>EMAIL ALERTS</li>
            </ul>
          </div>
          <figure className="hero-figure" aria-label="Subedeharana Kere, Bengaluru, in 2019 and 2026">
            <div className="hero-stack">
              <div className="shot back">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/thumbs/hero-subedeharana-2019.png" alt="Subedeharana Kere in early 2019, with the lake outline" />
                <span className="label">JAN–APR 2019</span>
              </div>
              <div className="shot front">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/thumbs/hero-subedeharana-2026.png" alt="Subedeharana Kere in early 2026, with the filled area outlined in amber" />
                <span className="label">JAN–APR 2026</span>
              </div>
            </div>
            <figcaption>
              <Guide size={60}>
                <span className="hero-caption">
                  <strong>{(subede?.flaggedAc ?? 0.94).toFixed(2)} ac</strong>
                  <span>
                    <span className="flag-key" />of Subedeharana Kere was filled in after residents reported debris dumping
                    in February 2024. It&apos;s still land, and it held up when we checked it on high-resolution photos.{" "}
                    <Link href="/lake/subedeharana-kere/">Show me</Link>
                  </span>
                </span>
              </Guide>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="collage-band" aria-label="Lakes across India, as Sentinel-2 sees them">
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

      {/* Why: what a lake does for the street around it */}
      <section id="why" className="wrap section" aria-labelledby="why-title">
        <span className="kicker">Why it matters <span className="local-word">· ಕೆರೆ, kere: Kannada for lake</span></span>
        <div className="split" style={{ alignItems: "flex-start", marginTop: 6 }}>
          <div className="say">
            <h2 id="why-title" className="section-title">A lake is the city&apos;s sponge, its well and its commons.</h2>
            <p>
              Bengaluru&apos;s <em>keres</em> were dug centuries ago as a chain: each one catches the monsoon, fills, and
              spills into the next. Fill one in and the water doesn&apos;t disappear. It goes into basements, roads and
              the next lake downstream.
            </p>
          </div>
          <div className="big-stats">
            <div className="big-stat"><b>472 ac</b><p>of Bengaluru lake land identified as encroached by the city corporation</p></div>
            <div className="big-stat"><b style={{ color: "var(--amber-ink)" }}>17.38 ac</b><p>of it reclaimed so far</p></div>
            <p className="small muted" style={{ margin: 0 }}>
              Source: <a href="https://sandrp.in/2026/02/10/bengaluru-lakes-2025-buffer-zone-amended-pollution-rising/">SANDRP, Bengaluru Lakes 2025</a> (Feb 2026), summarising The New Indian Express.
            </p>
          </div>
        </div>
        <div className="services">
          <div className="service">
            <Icon d="M12 3c3.5 4.2 6 7.6 6 10.5A6 6 0 0 1 6 13.5C6 10.6 8.5 7.2 12 3Z" />
            <h3>It holds the monsoon</h3>
            <p>Lakes and their 30 m buffers take the overflow. In September 2022, overflowing lakes and blocked drains flooded Bengaluru&apos;s IT corridor.</p>
            <p className="src"><a href="https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Frain-brings-bengalurus-it-corridor-to-a-standstill-1142546.html">Deccan Herald, Sep 2022</a></p>
          </div>
          <div className="service">
            <Icon d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
            <h3>It refills your borewell</h3>
            <p>Water held in a lake soaks into the ground around it. In March 2024 about half of Bengaluru&apos;s borewells ran dry.</p>
            <p className="src"><a href="https://www.newslaundry.com/2024/03/20/over-exploited-groundwater-neglected-lakes-heres-why-bengaluru-is-facing-a-water-crisis">IndiaSpend via Newslaundry, Mar 2024</a></p>
          </div>
          <div className="service">
            <Icon d="M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <h3>It belongs to everyone</h3>
            <p>Yet surveys of the same lake disagree: at Bellandur, 16 acres encroached by one count and at least 36 by another. A dated photo record is something everyone can check.</p>
            <p className="src"><a href="https://www.deccanherald.com/india/karnataka/bengaluru/confusion-over-extent-lake-encroachment-2002391">Deccan Herald</a></p>
          </div>
        </div>
      </section>

      <div className="wrap"><hr className="waterline" /></div>

      {/* Lakes we've checked */}
      <section id="lakes" className="wrap section" aria-labelledby="lakes-title">
        <div className="section-head">
          <div className="say">
            <span className="kicker">Lakes we&apos;ve checked</span>
            <h2 id="lakes-title" className="section-title">
              {analysed.length || 13} lakes, every summer since 2019
            </h2>
            <p>
              {catalogSize > 0
                ? `Another ${(catalogSize - analysed.length).toLocaleString("en-IN")} named lakes across India are mapped and waiting their turn; search for yours to see its outline.`
                : "More lakes across India are mapped and waiting their turn."}
            </p>
          </div>
          <Link href="/lakes/" className="button secondary">Find your lake <Arrow size={16} /></Link>
        </div>
        {analysed.length > 0 && (
          <Guide size={52} className="section-guide" interactive={false}>
            {`At ${changed.length} of these ${analysed.length} lakes I found lake that turned to land and stayed; ${steady.length} held steady. Amber means look closer, not guilty: some of that change is the city's own works.`}
          </Guide>
        )}
        <div className="lake-grid">{preview.map((c) => <LakeCard key={c.id} c={c} facts={false} />)}</div>
      </section>

      {/* What you can do */}
      <section id="act" className="section" aria-labelledby="act-title">
        <div className="band ripples" style={{ padding: "64px 0" }}>
          <div className="wrap">
            <span className="kicker">What you can do</span>
            <h2 id="act-title" className="section-title" style={{ maxWidth: 760 }}>From &ldquo;I think the lake is shrinking&rdquo; to a letter the custodian has to answer.</h2>
            <div className="acts" style={{ marginTop: 28 }}>
              <div className="act">
                <h3>Check your lake</h3>
                <p>See it in early 2019 and now, side by side, with every patch that turned to land outlined and dated.</p>
                <Link href="/lakes/">Find your lake</Link>
              </div>
              <div className="act">
                <h3>Report it with proof</h3>
                <p>Download a dated evidence pack and a complaint and RTI letter already filled with the area, location and dates.</p>
                <Link href="/lake/subedeharana-kere/evidence/#letters">See an evidence pack</Link>
              </div>
              <div className="act">
                <h3>Hear when it changes</h3>
                <p>We re-check every lake on the 5th of each month. If new change appears, you get one email, not a newsletter.</p>
                <Link href="/watchlist/">How alerts work</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How we check */}
      <section id="how" className="wrap section" aria-labelledby="how-title">
        <span className="kicker">How we check</span>
        <h2 id="how-title" className="section-title" style={{ maxWidth: 780, marginBottom: 36 }}>
          Summer against summer. Only change that stays.
        </h2>
        <ol className="process">
          <li><b>Every photo</b><span>Every Sentinel-2 satellite photo of the lake since 2019, free from the AWS Open Data registry.</span></li>
          <li><b>No clouds</b><span>Clouds and shadows are dropped; a summer counts only with at least 3 clear photos.</span></li>
          <li><b>Summer vs summer</b><span>January–April of each year, so a dry summer is never mistaken for a lost lake.</span></li>
          <li><b>Water or land</b><span>Open water and floating weeds count as lake; filled, bare, built or grassed-over ground doesn&apos;t.</span></li>
          <li><b>Only what stays</b><span>Land must stay land two summers running, in patches of at least 500 m² (about four 30×40 ft house plots).</span></li>
          <li><b>Show and share</b><span>Then-and-now photos, a map of every change and an evidence pack with draft letters.</span></li>
        </ol>
        <p className="small muted" style={{ marginTop: 18 }}>
          Runs on AWS: one Lambda container per lake (about two minutes), Step Functions across lakes, results in S3 and
          DynamoDB, a monthly EventBridge re-check and SNS email alerts.
        </p>
      </section>

      <div className="wrap"><hr className="waterline" /></div>

      {/* Honesty ledger */}
      <section id="honest" className="wrap section" aria-labelledby="honest-title">
        <div className="say">
          <span className="kicker">How often we&apos;re right</span>
          <h2 id="honest-title" className="section-title">We checked our own flags. Here&apos;s the score.</h2>
          <p>
            A satellite flag is a lead, not a verdict. So we went back to every one of the {LEDGER.total} flags on the
            lakes we&apos;ve analysed and compared it with high-resolution historical photos: {LEDGER.byPerson} by a person
            in Google Earth Pro, {LEDGER.byAi} by an AI-assisted review that a person can repeat.
          </p>
        </div>
        <div className="ledger">
          <div className="ok"><b>{LEDGER.confirmed}</b><span>held up: the lake really did turn to land, fill, a road or a structure</span></div>
          <div className="no"><b>{LEDGER.notConfirmed}</b><span>didn&apos;t: still water, usually at the edge where floating weeds or bright fill fooled a 10 m pixel</span></div>
          <div><b>{LEDGER.unsure}</b><span>couldn&apos;t tell from the photos available, often reed beds after desilting works</span></div>
        </div>
        <div className="ledger-bar" role="img" aria-label={`${LEDGER.confirmed} held up, ${LEDGER.notConfirmed} did not, ${LEDGER.unsure} unclear`}>
          <i style={{ width: pct(LEDGER.confirmed), background: "var(--flag)" }} />
          <i style={{ width: pct(LEDGER.notConfirmed), background: "var(--line-strong)" }} />
          <i style={{ width: pct(LEDGER.unsure), background: "var(--sage)" }} />
        </div>
        <p className="lede" style={{ marginTop: 18, maxWidth: 760 }}>
          That&apos;s why every flag on a lake page says whether it held up. Use the ones that did; treat the rest as a
          reason to go and look.
        </p>
      </section>

      {/* The fine print */}
      <section id="method" className="wrap section" aria-labelledby="method-title">
        <span className="kicker">The fine print</span>
        <h2 id="method-title" className="section-title" style={{ marginBottom: 24 }}>What the numbers mean, and what they don&apos;t.</h2>
        <dl className="limits">
          <div><dt>What we compare</dt><dd>Sentinel-2 satellite photos, January–April each year from 2019 to 2026; post-monsoon photos only grade confidence.</dd></div>
          <div><dt>Starting point</dt><dd>The 2019 and 2020 summers. Anything lost before 2019 isn&apos;t in this record.</dd></div>
          <div><dt>Smallest change</dt><dd>10 m pixels. A patch must be at least 500 m²; small sheds and walls are missed.</dd></div>
          <div><dt>Lasting change</dt><dd>Land two summers running is &ldquo;confirmed&rdquo;; one summer is &ldquo;new&rdquo;. Water coming back resets it.</dd></div>
          <div><dt>Weeds aren&apos;t land</dt><dd>Weeds floating on water reflect little shortwave infrared; grass on filled ground reflects much more. Weeds stay lake.</dd></div>
          <div><dt>Cloudy years</dt><dd>Fewer than 3 clear photos in a summer means &ldquo;not enough data&rdquo;, never a guess.</dd></div>
          <div><dt>Not a land survey</dt><dd>We measure against where the water used to be, not the revenue boundary. Legal works (desilting, walkways, sewage plants) show up too.</dd></div>
          <div><dt>Check before you act</dt><dd>Every flag needs a look on the ground and in official records, whatever the photos say.</dd></div>
        </dl>
        <Guide size={60} tone="info" className="section-guide">
          <strong>Satellites show that land changed, not who changed it or whether it was allowed.</strong> I can tell you
          where and when a lake changed; you and the records decide what it means.
        </Guide>
      </section>

      {/* Credits */}
      <section id="credits" className="wrap section" style={{ paddingBottom: 96 }} aria-labelledby="credits-title">
        <span className="kicker">Data and credits</span>
        <h2 id="credits-title" className="section-title" style={{ marginBottom: 24 }}>Open data, credited.</h2>
        <div className="credits">
          <div><b>Copernicus Sentinel-2</b>Contains modified Copernicus Sentinel data (2019–2026). Level-2A COGs from the <a href="https://registry.opendata.aws/sentinel-2-l2a-cogs/">Registry of Open Data on AWS</a>, found through <a href="https://github.com/element84/earth-search">Earth Search</a> by Element 84.</div>
          <div><b>ATREE-CSEI lake outlines</b><a href="https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area">Map of Lakes in Bengaluru Urban</a>, CC BY, via OpenCity.</div>
          <div><b>OpenStreetMap</b>Lake outlines across India and the basemap. © OpenStreetMap contributors, ODbL.</div>
          <div><b>Checking photos</b>Esri World Imagery Wayback and Google Earth Pro historical imagery, used only to check flags, never republished.</div>
        </div>
      </section>
    </main>
  );
}
