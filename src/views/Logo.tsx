export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick}>
      <span className="logo-names">
        <span style={{ color: '#A9477B' }}>Ella</span> <em>&amp;</em> <span style={{ color: '#1B6B56' }}>Jackson</span>
      </span>
      <span className="logo-sub">Household</span>
    </button>
  );
}
