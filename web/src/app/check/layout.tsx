import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plot Check",
  description:
    "Before you buy or rent: was this spot ever lake water, does it get waterlogged after the monsoon, and did radar see it flood? Eight years of satellite evidence for any pin in India.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
