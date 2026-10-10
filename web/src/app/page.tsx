"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { BhalswaStory } from "@/components/LakeStory";
import Jal from "@/components/Mascot";
import { Arrow } from "@/components/SiteHeader";
import { LANGS, ui, useLang } from "@/lib/lang";
import { cards } from "@/lib/catalog";
import { type LakeSummary, loadIndex } from "@/lib/data";
import { loadInsights } from "@/lib/insights";

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

type Impact = { confirmedAc: number; confirmedLakes: number; ponds: number; fixable: number; coolerC: number; heatLakes: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/** What changes because of JalRekha, problem by problem, with a real number as proof where there is one. */
function ImpactBand() {
  const [x, setX] = useState<Impact | null>(null);
  useEffect(() => {
    Promise.all([loadInsights(), fetch("/ponds/delhi/summary.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)])
      .then(([ins, ponds]) => {
        const checked = Object.values(ins.checked).filter((c) => c.confirmed_ac > 0);
        const cooler = Object.values(ins.heat)
          .flatMap((h) => (h.water_c != null && h.near_c != null ? [h.near_c - h.water_c] : []));
        setX({
          confirmedAc: checked.reduce((a, c) => a + c.confirmed_ac, 0),
          confirmedLakes: checked.length,
          ponds: ponds?.vanished ?? 0,
          fixable: ponds?.now?.dried_grassed ?? 0,
          coolerC: median(cooler),
          heatLakes: cooler.length,
        });
      });
  }, []);
  if (!x) return null;
  const rows: { tone: string; was: string; now: string; proof?: string; href: string; cta: string }[] = [
    {
      tone: "buy", href: "/check/", cta: "Check a plot",
      was: "You find out the plot was a lake after the first flood, and after you've paid.",
      now: "Drop a pin before you pay. In about two minutes you know if water stood there since 2019, and what to ask the seller.",
      proof: "Fewer people buy filled lake land, so filling a lake stops paying.",
    },
    {
      tone: "loss", href: "/lakes/priority/", cta: "Which lakes to save first",
      was: "A lake is noticed shrinking years later, when it is already built over.",
      now: "It is spotted within a season, with dated photos, a map file and a letter to the right authority.",
      proof: x.confirmedAc > 0 ? `${x.confirmedAc.toFixed(1)} acres of lost lake bed confirmed so far, across ${x.confirmedLakes} lakes.` : undefined,
    },
    {
      tone: "pond", href: "/ponds/", cta: "Adopt a pond",
      was: "A dried-up pond is forgotten, and nobody knows which office owns it.",
      now: "A local group adopts it, the letter goes to the land-owning agency, and a public clock shows if they answer.",
      proof: x.ponds > 0 ? `${x.ponds} dried-up ponds in Delhi are ready to adopt; ${x.fixable} are easy to bring back.` : undefined,
    },
    {
      tone: "cool", href: "/ponds/board/", cta: "See the public clock",
      was: "“Work done” is claimed, and nobody checks whether the water came back.",
      now: "The satellite checks the pond for everyone to see, and flags claims it can’t see.",
      proof: x.heatLakes > 0 ? `Worth it: lake water is usually about ${Math.round(x.coolerC)} °C cooler than the ground around it on summer mornings.` : undefined,
    },
  ];
  return (
    <section className="wrap impact" aria-labelledby="impact-title">
      <span className="eyebrow">What changes</span>
      <h2 id="impact-title" className="section-title" style={{ marginBottom: 20 }}>From finding out too late, to fixing it in time.</h2>
      <div className="impact-rows">
        {rows.map((r) => (
          <Link key={r.tone} href={r.href} className={`impact-row ${r.tone}`}>
            <div className="impact-was"><small>Today</small><p>{r.was}</p></div>
            <div className="impact-now"><small>With JalRekha</small><p>{r.now}</p>{r.proof && <p className="impact-proof">{r.proof}</p>}</div>
            <em>{r.cta} →</em>
          </Link>
        ))}
      </div>
      <p className="small muted">
        Numbers come from free satellite photos (Sentinel-2, Landsat); a change counts as lost only once it held up on
        sharper photos. <Link href="/how-sure/">How sure is it?</Link>
      </p>
    </section>
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


  return (
    <main className="home">
      {/* Hero: the one question we answer */}
      {/* The hero sits on an illustration of a city lake; its misty left side carries the headline. */}
      <div className="hero-band">
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
        </section>
      </div>

      {/* What changes: today, and with JalRekha */}
      <ImpactBand />

      {/* How it works: a scroll story on one real lake */}
      <section id="how" className="wrap section" aria-labelledby="how-title" data-jal-mood="scanning"
        data-jal="This is a real lake: Bhalswa, in north Delhi. Keep scrolling and each step adds one layer to the satellite photo, so you can see exactly how I spot water that was lost.">
        <span className="eyebrow">How it works</span>
        <h2 id="how-title" className="section-title" style={{ marginBottom: 8 }}>Watch it work on a real Delhi lake.</h2>
        <p className="lede" style={{ maxWidth: 680, marginBottom: 28 }}>
          Use the arrows. Each step adds one layer to the real satellite photo of Bhalswa Lake.
        </p>
        <BhalswaStory />
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

      {/* Close: one clear next step for everyone */}
      <section id="act" className="act-band" aria-labelledby="act-title" data-jal-mood="celebrate"
        data-jal="Every lake is next to someone's home. Check a plot, find your lake, or adopt a pond near you. I'll keep watching from space.">
        <div className="wrap act-inner">
          <div className="act-copy">
            <span className="act-kicker">Start with the lake near you</span>
            <h2 id="act-title" className="act-title">Every lake is next to someone&rsquo;s home. Start with yours.</h2>
            <div className="act-buttons">
              <Link href="/check/" className="button big act-primary">Check a plot <Arrow /></Link>
              <Link href="/lakes/" className="button big act-secondary">Find your lake</Link>
              <Link href="/ponds/" className="button big act-secondary">Adopt a pond</Link>
            </div>
            <p className="act-note">
              Free, in English, हिन्दी, ಕನ್ನಡ and తెలుగు. Watch a lake and get one email when it changes. <Link href="/watchlist/">How alerts work</Link>
            </p>
          </div>
          <div className="act-jal" aria-hidden="true"><Jal size={170} interactive={false} mood="celebrate" /></div>
        </div>
      </section>

    </main>
  );
}
