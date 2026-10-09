import type { Metadata } from "next";
import Link from "next/link";
import Jal from "@/components/Mascot";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="not-found">
      <Jal size={132} />
      <span className="eyebrow">404</span>
      <h1>This page has dried up.</h1>
      <p className="lede">
        Jal searched every dry season and couldn&apos;t find it. The lakes are still here, though.
      </p>
      <div className="row" style={{ gap: 12, justifyContent: "center" }}>
        <Link href="/lakes/" className="button">Explore lakes</Link>
        <Link href="/" className="button secondary">Home</Link>
      </div>
    </main>
  );
}
