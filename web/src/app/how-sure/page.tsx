"use client";

// How sure is it? What the satellite can and can't see, how often our flags held up on
// sharper photos, how a lake is checked, and the fine print. Moved off the home page to keep it short.

import Link from "next/link";
import { Guide } from "@/components/Mascot";

const LEDGER = { total: 46, confirmed: 14, notConfirmed: 21, unsure: 11, byPerson: 11, byAi: 35 };
const pct = (n: number) => `${(n / LEDGER.total) * 100}%`;

export default function HowSure() {
  return (
    <main className="home how-sure">
      <section className="wrap section" style={{ paddingBottom: 0 }}>
        <Link href="/" className="small">&larr; Home</Link>
        <h1 className="section-title" style={{ marginTop: 12 }}>How sure is it?</h1>
        <p className="lede" style={{ maxWidth: 760 }}>
          What the satellite can and can&rsquo;t see, how often our flags held up when we checked them, and how every
          lake is checked.
        </p>
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
