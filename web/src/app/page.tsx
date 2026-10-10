"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { BhalswaStory } from "@/components/LakeStory";
import Jal, { Guide, type Mood } from "@/components/Mascot";
import { Arrow } from "@/components/SiteHeader";
import { LANGS, ui, useLang } from "@/lib/lang";
import { cards } from "@/lib/catalog";
import { type Heat, loadInsights } from "@/lib/insights";
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

// Every flag the pipeline raised on the analysed lakes, checked against high-resolution
// historical photos (research/flags_checked.csv, 10 Oct 2026).
const LEDGER = { total: 46, confirmed: 14, notConfirmed: 21, unsure: 11, byPerson: 11, byAi: 35 };

/** Lakes keep you cool: the Heat half of the story, on the hero lake, from Landsat. */
function CoolBand() {
  const [h, setH] = useState<Heat | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    void loadInsights().then((i) => {
      setH(i.heat.bhalswa ?? null);
      setN(Object.keys(i.heat).length);
    });
  }, []);
  if (!h || h.water_c == null || h.near_c == null) return null;
  const cooler = h.near_c - h.water_c;
  return (
    <section id="cool" className="wrap section" aria-labelledby="cool-title" data-jal-mood="celebrate"
      data-jal={`Lakes also keep us cool. On summer mornings Bhalswa's water is about ${Math.round(cooler)} degrees cooler than the ground around it${h.filled_hotter_c ? `, and where the lake was filled in the ground got ${h.filled_hotter_c.toFixed(1)} degrees hotter` : ""}. This comes from the Landsat heat sensor.`}>
      <div className="cool-band">
        <div>
          <span className="eyebrow">Heat</span>
          <h2 id="cool-title" className="section-title">Lakes keep a city cool. Filled lakes heat it up.</h2>
          <p className="lede">
            Satellites also measure how hot the ground gets. In the hottest weeks before the monsoon, Delhi&rsquo;s Bhalswa Lake
            is a cool strip in a hot city, and the lake bed that was filled in has already warmed up.
          </p>
          <div className="cool-facts">
            <div className="cold"><b>{cooler.toFixed(1)} °C</b><span>cooler: the lake&rsquo;s water against the ground around it, on summer mornings</span></div>
            {h.filled_hotter_c != null && h.filled_hotter_c > 0 && (
              <div className="hot"><b>+{h.filled_hotter_c.toFixed(1)} °C</b><span>where the lake bed was filled in, against the water still there</span></div>
            )}
          </div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <Link href="/lake/bhalswa/#insights-title" className="button secondary">See Bhalswa&rsquo;s heat map</Link>
            <Link href="/lakes/priority/" className="button secondary">Which lakes to save first <Arrow size={16} /></Link>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            Ground temperature from {h.passes} Landsat 8 and 9 passes, April&ndash;May 2023&ndash;2025, on the Registry of Open Data on
            AWS. Measured for {n} lakes. It is the ground, not the air.
          </p>
        </div>
        <figure className="insight-figure" style={{ margin: 0 }} aria-label="Summer ground temperature around Bhalswa Lake">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={h.image} alt="Bhalswa Lake as a cool blue strip in hotter ground; red is the hottest ground" />
        </figure>
      </div>
    </section>
  );
}

/** The site in four languages, and Jal as a guide: right under the headline, where people look first. */
function ReadIn() {
  const { lang, setLang, guideOn, setGuideOn } = useLang();
  return (
    <div className="read-in" data-no-translate>
      <span className="read-in-label">{ui("readIn", lang)}</span>
      <div className="read-in-langs" role="group" aria-label={ui("language", lang)}>
        {LANGS.map((l) => (
          <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.native}</button>
        ))}
      </div>
      {!guideOn && (
        <button type="button" className="read-in-jal" onClick={() => setGuideOn(true)}>
          <Jal size={30} interactive={false} mood="wink" />
          {ui("walk", lang)}
        </button>
      )}
    </div>
  );
}

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

  const pct = (n: number) => `${(n / LEDGER.total) * 100}%`;

  return (
    <main className="home">
      {/* Hero: the one question we answer */}
      <section className="wrap hero" aria-labelledby="hero-title" data-jal-mood="happy"
        data-jal="Hi, I'm Jal. Lakes soak up the monsoon and refill our borewells, but many are being filled in, one plot at a time. I watch them from space so you can see where.">
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
          <ReadIn />
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
                <strong>Soil pushed in</strong>
                <span>
                  <span className="flag-key" />along the south-east shore of Delhi&rsquo;s Bhalswa Lake, where there was water until 2024.
                  Spotted from space, then checked on sharper photos. <Link href="/lake/bhalswa/">See it</Link>
                </span>
              </span>
            </Guide>
          </figcaption>
        </figure>
      </section>

      {/* Who it helps */}
      <section id="who" className="wrap section" aria-labelledby="who-title" data-jal-mood="curious"
        data-jal="Three kinds of people use this. Buyers check a plot before they pay, neighbours report a lake being filled in, and cities see which lakes to protect before the rains.">
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
      <section id="how" className="wrap section" aria-labelledby="how-title" data-jal-mood="scanning"
        data-jal="This is a real lake: Bhalswa, in north Delhi. Keep scrolling and each step adds one layer to the satellite photo, so you can see exactly how I spot water that was lost.">
        <span className="eyebrow">How it works</span>
        <h2 id="how-title" className="section-title" style={{ marginBottom: 8 }}>Watch it work on a real Delhi lake.</h2>
        <p className="lede" style={{ maxWidth: 680, marginBottom: 28 }}>
          Scroll down. Each step adds one layer to the real satellite photo of Bhalswa Lake.
        </p>
        <BhalswaStory />
      </section>

      {/* Real results */}
      <section id="examples" className="wrap section" aria-labelledby="examples-title" data-jal-mood="thinking"
        data-jal="These are real answers from Plot Check. Red means the spot was probably lake bed, amber means be careful, and green means it stayed dry every year. Tap one to see the full report.">
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
      <section id="why" className="wrap section" aria-labelledby="why-title" data-jal-mood="worried"
        data-jal="Why does this matter? A lake is a city's free flood protection. Fill it in, and the rain goes into homes and streets instead.">
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

      <CoolBand />

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
      <section id="lakes" className="wrap section" aria-labelledby="lakes-title" data-jal-mood="happy"
        data-jal="These are lakes I check every month. Open one to see every year since 2019, or ask me to email you if it starts to shrink.">
        <div className="section-head">
          <div>
            <span className="eyebrow">Lakes we watch</span>
            <h2 id="lakes-title" className="section-title">Watch a lake. Get told if it shrinks.</h2>
            <p className="lede">
              We track {analysed.length || 27} lakes closely, check them every month, and email you if one starts to shrink.
              {catalogSize > 0 && <> {catalogSize.toLocaleString("en-IN")} lakes across India are on the map.</>}
            </p>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/lakes/priority/" className="button secondary">Which to save first</Link>
            <Link href="/lakes/" className="button secondary">See all lakes <Arrow size={16} /></Link>
          </div>
        </div>
        <div className="lake-grid">{preview.map((c) => <LakeCard key={c.id} c={c} facts={false} />)}</div>
      </section>

      {/* What you can do */}
      <section id="act" className="section" aria-labelledby="act-title" data-jal-mood="celebrate"
        data-jal="And here is what you can do: check your lake, report it with dated proof and a letter that's already written, and get one email when something changes.">
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

      {/* How sure is this? */}
      <section id="method" className="wrap section" aria-labelledby="method-title" data-jal-mood="cautious"
        data-jal="I'm a strong early warning, not a final verdict. I can't see legal boundaries or small sheds, so always check on the ground before you act.">
        <span className="eyebrow">How sure is this?</span>
        <h2 id="method-title" className="section-title" style={{ marginBottom: 20 }}>Strong early warning. Then verify on the ground.</h2>
        <ul className="plain-list">
          <li><b>What we see:</b> where water was, each year since 2019, from photos 10 metres sharp.</li>
          <li><b>What we don&rsquo;t:</b> the legal lake boundary, small walls or sheds, or floods hidden between tall buildings.</li>
          <li><b>Clouds:</b> if a season is too cloudy, we say &ldquo;not sure&rdquo; instead of guessing.</li>
          <li><b>Before you act:</b> check the official lake map and ask a lawyer. We tell you what to ask.</li>
        </ul>
      </section>

      {/* Honesty ledger */}
      <section id="honest" className="wrap section" aria-labelledby="honest-title" data-jal-mood="thinking"
        data-jal={`We checked my own flags against sharper photos. ${LEDGER.confirmed} of ${LEDGER.total} held up. That's why every flag on a lake page tells you whether it was checked.`}>
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

      {/* How we check */}
      <section id="pipeline" className="wrap section" aria-labelledby="pipeline-title" data-jal-mood="scanning"
        data-jal="Here's how I work: I compare the same dry months every year since 2019, and only count land that stays land two summers in a row.">
        <span className="kicker">How we check</span>
        <h2 id="pipeline-title" className="section-title" style={{ maxWidth: 780, marginBottom: 36 }}>
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

      {/* The fine print */}
      <section id="fine-print" className="wrap section" aria-labelledby="fine-print-title" data-jal-mood="wink"
        data-jal="Last, the fine print: what my numbers mean and what they don't. If a result matters to you, read this part.">
        <span className="kicker">The fine print</span>
        <h2 id="fine-print-title" className="section-title" style={{ marginBottom: 24 }}>What the numbers mean, and what they don&apos;t.</h2>
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
          <div><b>Copernicus Sentinel-1</b>Radar flood maps (Bengaluru 2022, Delhi 2023, Chennai 2015, Hyderabad 2020), from the <a href="https://registry.opendata.aws/sentinel-1/">Registry of Open Data on AWS</a>.</div>
          <div><b>ATREE-CSEI lake outlines</b><a href="https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area">Map of Lakes in Bengaluru Urban</a>, CC BY, via OpenCity.</div>
          <div><b>OpenStreetMap</b>Lake outlines across India and the basemap. © OpenStreetMap contributors, ODbL.</div>
          <div><b>Checking photos</b>Esri World Imagery Wayback and Google Earth Pro historical imagery, used only to check flags, never republished.</div>
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>
          Runs on AWS: Lambda, Step Functions, S3, DynamoDB, EventBridge, SNS, API Gateway, Amplify, Amazon Location, Amazon
          Translate (this site in Hindi, Kannada and Telugu), Amazon Polly (Jal&apos;s voice) and CodeBuild.
        </p>
      </section>
    </main>
  );
}
