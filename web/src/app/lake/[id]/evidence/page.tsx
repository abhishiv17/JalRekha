import { generateStaticParams as lakeParams } from "../page";
import EvidenceView from "./EvidenceView";

export const generateStaticParams = lakeParams;

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EvidenceView id={id} />;
}
