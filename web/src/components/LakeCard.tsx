import Link from "next/link";
import LakeShape from "@/components/LakeShape";
import { type Card, placeLabel, statusOf } from "@/lib/catalog";
import { seasonLabel } from "@/lib/data";

const fmtAc = (ac: number) => (ac >= 100 ? Math.round(ac).toLocaleString("en-IN") : ac.toFixed(1)) + " ac";

/** Gallery card; analysed lakes link to their page, queued ones say what's missing. */
export default function LakeCard({ c, facts = true }: { c: Card; facts?: boolean }) {
  const status = statusOf(c);
  const tag = (c.city || c.state).toUpperCase();
  const body = (
    <>
      <div className="lake-thumb">
        {c.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumb} alt={`Satellite view of ${c.name}`} loading="lazy" />
        ) : c.shapeState ? (
          <LakeShape id={c.id} state={c.shapeState} label={c.name} />
        ) : null}
        <span className="label">{tag}</span>
      </div>
      <div className="lake-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="lake-name">{c.name}</h3>
          <div className="lake-place">{placeLabel(c)}</div>
        </div>
        <span className={`pill ${status.tone}`}>{status.label}</span>
      </div>
      {facts && (
        <dl className="lake-facts">
          <div><dt>LAKE</dt><dd>{c.areaAc != null ? fmtAc(c.areaAc) : "—"}</dd></div>
          <div><dt>CHANGED</dt><dd>{c.analysed ? `${(c.flaggedAc ?? 0).toFixed(2)} ac` : "—"}</dd></div>
          <div><dt>FIRST SEEN</dt><dd>{c.firstSeen ? seasonLabel(c.firstSeen).replace("Dry season ", "") : "—"}</dd></div>
        </dl>
      )}
    </>
  );
  return c.analysed ? (
    <Link href={`/lake/${c.id}/`} className="lake-card">{body}</Link>
  ) : (
    <article className="lake-card">{body}</article>
  );
}
