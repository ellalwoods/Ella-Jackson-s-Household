import { useId } from 'react';

const HEART = 'M50 88C22 68 4 52 4 31 4 15 15 4 29 4c10 0 17 6 21 14 4-8 11-14 21-14 14 0 25 11 25 27 0 21-18 37-46 57Z';

/**
 * One heart, Ella's pink on the left and Jackson's green on the right.
 * Used as the "&" in the wordmark. The app icon (public/icon.svg) is the inverse:
 * a white heart on a pink and green tile.
 */
export function HeartMark({ size = 24 }: { size?: number }) {
  const id = 'heart' + useId().replace(/[^\w-]/g, '');
  return (
    <svg className="heart-mark" viewBox="0 0 100 92" width={size * 100 / 92} height={size} aria-hidden="true">
      <clipPath id={id}><path d={HEART} /></clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width="50" height="92" fill="#E886B8" />
        <rect x="50" width="50" height="92" fill="#2A9E80" />
      </g>
    </svg>
  );
}

/** "Ella ♥ Jackson" with the heart standing in for the ampersand. */
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
