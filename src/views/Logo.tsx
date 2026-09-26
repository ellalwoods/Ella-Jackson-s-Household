/**
 * The 3a heart: Ella's and Jackson's circles as the lobes, meeting at the point.
 * Used as the "&" in the wordmark (with a dusty-blue point, as in logo 3e) and,
 * on a linen tile, as the app icon (public/icon.svg, with a butter point).
 */
export function HeartMark({ size = 24, point = '#8FB0CF' }: { size?: number; point?: string }) {
  return (
    <svg className="heart-mark" viewBox="19 23 62 56" width={size * 62 / 56} height={size} aria-hidden="true">
      <polygon points="22,51 50,79 78,51" fill={point} />
      <circle cx="37" cy="41" r="18" fill="#E886B8" />
      <circle cx="63" cy="41" r="18" fill="#2A9E80" />
    </svg>
  );
}

/** Logo 3e: "Ella ♥ Jackson" with the heart standing in for the ampersand. */
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Ella and Jackson, Household">
      <span className="logo-names">
        <span style={{ color: '#A9477B' }}>Ella</span>
        <HeartMark size={28} />
        <span style={{ color: '#1B6B56' }}>Jackson</span>
      </span>
      <span className="logo-sub">Household</span>
    </button>
  );
}
