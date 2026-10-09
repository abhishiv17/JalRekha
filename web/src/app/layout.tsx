import type { Metadata } from "next";
import Link from "next/link";
import { Figtree, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" });
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "KereWatch · lake evidence from space",
  description: "Dated, reproducible satellite evidence of change at India's lakes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <footer className="site">
          <div className="wrap">
            <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="brand-name" style={{ fontSize: 20 }}>KereWatch</span>
              <p style={{ margin: 0, maxWidth: 380 }}>
                Change detected from satellite imagery, not proof of encroachment. Verify on the ground and in records.
              </p>
            </div>
            <nav aria-label="Footer">
              <span className="footer-title">Pages</span>
              <Link href="/">Home</Link>
              <Link href="/lakes/">All lakes</Link>
              <Link href="/#method">How it works</Link>
              <Link href="/#evidence">Evidence pack</Link>
            </nav>
            <div style={{ flex: "0 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="footer-title">Data</span>
              <span>Contains modified Copernicus Sentinel data (2019–2026), via the Registry of Open Data on AWS.</span>
              <span>Lake outlines: ATREE-CSEI (CC BY). Map data © OpenStreetMap contributors.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
