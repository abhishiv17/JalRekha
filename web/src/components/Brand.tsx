// JalRekha identity: a lake-contour symbol and the wordmark, usable separately.

/** Three nested lake contours (rekha = line) with an amber change mark. */
export function BrandMark({ size = 34, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role={title ? "img" : undefined}
      aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="40" height="40" rx="10" fill="var(--brand)" />
      <path d="M8.5 21.5c0-7.4 5.6-12.6 12.2-12.6 6.9 0 11.3 4.6 11.3 10.4 0 6.6-5.2 11.5-12.4 11.5-6.5 0-11.1-3.9-11.1-9.3Z"
        fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.6" />
      <path d="M13 21.2c0-4.6 3.5-8 7.7-8 4.4 0 7.1 2.9 7.1 6.5 0 4.1-3.3 7.2-7.8 7.2-4.1 0-7-2.4-7-5.7Z"
        fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" />
      <path d="M17.2 20.9c0-2 1.6-3.5 3.5-3.5 2 0 3.2 1.3 3.2 2.9 0 1.8-1.5 3.2-3.5 3.2-1.9 0-3.2-1.1-3.2-2.6Z" fill="#fff" />
      <rect x="27.5" y="7" width="5.5" height="5.5" rx="1.4" fill="var(--flag)" />
    </svg>
  );
}

export function Wordmark({ sub = true }: { sub?: boolean }) {
  return (
    <span className="wordmark">
      <span className="wordmark-name">Jal<span>Rekha</span></span>
      {sub && <span className="wordmark-sub">Lake change from space</span>}
    </span>
  );
}

export default function Logo() {
  return (
    <span className="brand">
      <BrandMark />
      <Wordmark />
    </span>
  );
}
