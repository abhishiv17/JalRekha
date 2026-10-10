import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Noto_Sans_Devanagari, Noto_Sans_Kannada, Noto_Sans_Telugu, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { StaticLogo } from "@/components/Brand";
import JalGuide from "@/components/JalGuide";
import PageTranslator from "@/components/PageTranslator";
import SiteHeader from "@/components/SiteHeader";
import { LangProvider } from "@/lib/lang";

const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" });
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });
// Hindi, Kannada and Telugu. Browsers only download a script's font when a page shows that script.
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600", "800"], variable: "--font-deva", preload: false });
const knda = Noto_Sans_Kannada({ subsets: ["kannada"], weight: ["400", "600", "800"], variable: "--font-knda", preload: false });
const telu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "600", "800"], variable: "--font-telu", preload: false });

const description =
  "Satellite photos that show where lakes are being filled in, so buyers can check a plot before paying, citizens can report it, and cities can act before the monsoon.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "JalRekha · Lakes protect our cities. Let’s protect lakes.", template: "%s · JalRekha" },
  description,
  applicationName: "JalRekha",
  openGraph: {
    type: "website",
    siteName: "JalRekha",
    title: "JalRekha · Lakes protect our cities. Let’s protect lakes.",
    description,
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "JalRekha: satellite view of a lake with a detected change outlined" }],
  },
  twitter: { card: "summary_large_image", title: "JalRekha", description, images: ["/brand/og.png"] },
};

export const viewport: Viewport = { themeColor: "#1f5c3f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${deva.variable} ${knda.variable} ${telu.variable}`}>
      <body>
        <LangProvider>
          <a href="#content" className="skip-link">Skip to content</a>
          <SiteHeader />
          <div id="content">{children}</div>
          <footer className="site">
            <div className="wrap">
              <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <StaticLogo size={40} />
                <p style={{ margin: 0, maxWidth: 380 }}>
                  Lakes protect our cities. Let’s protect lakes. Built for WeMakeDevs Environmental Hacks, Heat and Water track.
                </p>
                <p style={{ margin: 0, maxWidth: 380 }}>
                  A satellite shows where a lake changed, not who changed it or whether it was allowed. Check on the ground and in official records.
                </p>
              </div>
              <nav aria-label="Footer">
                <span className="footer-title">Explore</span>
                <Link href="/check/">Check a plot</Link>
                <Link href="/lakes/">Lakes we track</Link>
                <Link href="/lakes/priority/">Which lakes to save first</Link>
                <Link href="/lakes/?status=queued">All lakes in India</Link>
                <Link href="/watchlist/">Your watchlist</Link>
              </nav>
              <nav aria-label="About">
                <span className="footer-title">About</span>
                <Link href="/#how">How it works</Link>
                <Link href="/how-sure/">How sure is it?</Link>
                <Link href="/how-sure/#honest">How often we&apos;re right</Link>
                <Link href="/how-sure/#credits">Where the data comes from</Link>
              </nav>
              <div style={{ flex: "0 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="footer-title">Data</span>
                <span>Contains modified Copernicus Sentinel data (2019–2026), via the Registry of Open Data on AWS.</span>
                <span>Lake outlines: ATREE-CSEI (CC BY) and © OpenStreetMap contributors (ODbL).</span>
              </div>
            </div>
          </footer>
          <PageTranslator />
          <JalGuide />
        </LangProvider>
      </body>
    </html>
  );
}
