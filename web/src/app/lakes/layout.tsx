import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Monitored lakes",
  description: "Analysed lakes with satellite change results, and the India-wide catalogue of named lakes queued for analysis.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
