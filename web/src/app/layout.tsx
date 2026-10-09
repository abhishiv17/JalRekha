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
  "Is your lake being filled in? JalRekha compares satellite photos of every summer since 2019, shows where a lake has turned to land, and helps residents act with dated evidence and ready letters.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "JalRekha · Is your lake being filled in?", template: "%s · JalRekha" },
  description,
  applicationName: "JalRekha",
  openGraph: {
    type: "website",
    siteName: "JalRekha",
    title: "JalRekha · Is your lake being filled in?",
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
                <em>Jal</em> is water, <em>rekha</em> is a line. We keep watch on the line where a lake ends, so the people
                who live beside it notice when that line moves.
              </p>
              <p style={{ margin: 0, maxWidth: 380 }}>
                Satellites show that land changed, not who changed it or whether it was allowed. Verify on the ground and in
                official records. Built for WeMakeDevs Environmental Hacks, Heat and Water track.
              </p>
            </div>
            <nav aria-label="Footer">
              <span className="footer-title">Lakes</span>
              <Link href="/lakes/">Find a lake</Link>
              <Link href="/lakes/?status=changed">Lakes that changed</Link>
              <Link href="/watchlist/">My alerts</Link>
            </nav>
            <nav aria-label="About">
              <span className="footer-title">How we work</span>
              <Link href="/#how">How we check</Link>
              <Link href="/#honest">How often we&apos;re right</Link>
              <Link href="/#method">The fine print</Link>
              <Link href="/#credits">Data and credits</Link>
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
