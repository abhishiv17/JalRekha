import { generateStaticParams as lakeParams } from "../page";
import type { Metadata } from "next";
import EvidenceView from "./EvidenceView";

export const metadata: Metadata = { title: "Evidence pack" };

export const generateStaticParams = lakeParams;

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EvidenceView id={id} />;
}
