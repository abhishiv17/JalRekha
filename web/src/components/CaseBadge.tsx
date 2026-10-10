import { STAGE_WORDS, type PondCase } from "@/lib/ponds";

/** A pond case in one short phrase: revived, flagged, overdue, or its stage. */
export default function CaseBadge({ c }: { c?: PondCase | null }) {
  if (!c?.stage) return null;
  if (c.revived) return <span className="pill case-pill revived">Revived: water seen from space</span>;
  if (c.claim_not_seen) return <span className="pill case-pill flagged">Says water is back; satellite sees none</span>;
  if (c.overdue) return <span className="pill case-pill flagged">Agency overdue: {c.waiting_days} days, no answer</span>;
  return (
    <span className="pill case-pill">
      {STAGE_WORDS[c.stage].label}
      {c.stage === "sent" && c.waiting_days !== undefined ? `: day ${c.waiting_days} of 30` : ""}
    </span>
  );
}
