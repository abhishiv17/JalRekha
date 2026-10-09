import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lakes",
  description: "See which lakes are shrinking, year by year, from satellite photos. Lakes we track closely, and every named lake in India on one map.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
