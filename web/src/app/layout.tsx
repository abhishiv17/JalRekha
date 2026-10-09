import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { StaticLogo } from "@/components/Brand";
import SiteHeader from "@/components/SiteHeader";

const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" });
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

const description =
  "JalRekha compares historical satellite imagery to find lasting change in lake beds and buffer zones, and turns it into dated, reproducible evidence for lake conservation.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "JalRekha · See how our lakes change over time", template: "%s · JalRekha" },
  description,
  applicationName: "JalRekha",
  openGraph: {
    type: "website",
    siteName: "JalRekha",
    title: "JalRekha · See how our lakes change over time",
    description,
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "JalRekha: satellite view of a lake with a detected change outlined" }],
  },
  twitter: { card: "summary_large_image", title: "JalRekha", description, images: ["/brand/og.png"] },
};

export const viewport: Viewport = { themeColor: "#1f5c3f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#content" className="skip-link">Skip to content</a>
        <SiteHeader />
        <div id="content">{children}</div>
        <footer className="site">
          <div className="wrap">
            <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <StaticLogo size={40} />
              <p style={{ margin: 0, maxWidth: 380 }}>
                See how our lakes change over time. Built for WeMakeDevs Environmental Hacks, Heat and Water track.
              </p>
              <p style={{ margin: 0, maxWidth: 380 }}>
                Satellite-detected change is not proof of illegal encroachment. Verify on the ground and in official records.
              </p>
            </div>
            <nav aria-label="Footer">
              <span className="footer-title">Explore</span>
              <Link href="/lakes/">Monitored lakes</Link>
              <Link href="/lakes/?status=queued">India catalogue</Link>
              <Link href="/watchlist/">Your watchlist</Link>
            </nav>
            <nav aria-label="About">
              <span className="footer-title">About</span>
              <Link href="/#how">How it works</Link>
              <Link href="/#method">Methodology and limits</Link>
              <Link href="/#credits">Data sources and credits</Link>
            </nav>
            <div style={{ flex: "0 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="footer-title">Data</span>
              <span>Contains modified Copernicus Sentinel data (2019–2026), via the Registry of Open Data on AWS.</span>
              <span>Lake outlines: ATREE-CSEI (CC BY) and © OpenStreetMap contributors (ODbL).</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
