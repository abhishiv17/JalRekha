"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import LakeCard from "@/components/LakeCard";
import { BhalswaStory } from "@/components/LakeStory";
import Jal from "@/components/Mascot";
import { Arrow } from "@/components/SiteHeader";
import { LANGS, ui, useLang } from "@/lib/lang";
import { cards } from "@/lib/catalog";
import { type LakeSummary, loadIndex } from "@/lib/data";

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

/**
 * A 30-second tour of everything JalRekha does, made from its own screens and numbers. It has no
 * sound, so it can play muted on its own (phones allow that) while it is on screen; it
 * pauses when scrolled away, and waits for a tap if the visitor prefers less motion.
 */
function VideoBand() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <section className="wrap video-band" aria-labelledby="video-title" data-jal-mood="wink"
      data-jal="Start here: in thirty seconds, everything I can do for you, from checking a plot to the email you get when your lake changes.">
      <span className="eyebrow">JalRekha in 30 seconds</span>
      <h2 id="video-title" className="section-title">See what JalRekha does.</h2>
      <div className="video-frame">
        <video ref={ref} controls muted loop playsInline preload="metadata" poster="/video/jalrekha-explainer.jpg"
          aria-label="JalRekha in 30 seconds: lakes hold monsoon rain, refill borewells and cool the streets, and they are being filled in. JalRekha watches 7,178 lakes across India from space. You can see each lake's story, track any lake, check a plot before you buy, see heat and floods, report with proof, watch a lake and get one email when it changes, see which lakes to save first, adopt a dried-up pond, and use it all in English, Hindi, Kannada or Telugu.">
          <source src="/video/jalrekha-explainer-720.mp4" type="video/mp4" media="(max-width: 900px)" />
          <source src="/video/jalrekha-explainer.webm" type='video/webm; codecs="vp9"' />
          <source src="/video/jalrekha-explainer.mp4" type="video/mp4" />
          <a href="/video/jalrekha-explainer.mp4">Watch the video</a>
        </video>
      </div>
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

      {/* The idea in a short film */}
      <VideoBand />

      {/* How it works: a scroll story on one real lake */}
      <section id="how" className="wrap section" aria-labelledby="how-title" data-jal-mood="scanning"
        data-jal="This is a real lake: Bhalswa, in north Delhi. Keep scrolling and each step adds one layer to the satellite photo, so you can see exactly how I spot water that was lost.">
        <span className="eyebrow">How it works</span>
        <h2 id="how-title" className="section-title" style={{ marginBottom: 8 }}>Watch it work on a real Delhi lake.</h2>
        <p className="lede" style={{ maxWidth: 680, marginBottom: 28 }}>
          Keep scrolling. Each step adds one layer to the real satellite photo of Bhalswa Lake.
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
