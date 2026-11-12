/** The Scope mark (branding/logo.svg). Ink follows --text, the sweep and target follow --accent. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Aurelia Radio" className="logo-mark">
      <circle cx="50" cy="50" r="36" fill="none" stroke="var(--text)" strokeWidth="6" />
      <circle cx="50" cy="50" r="19" fill="none" stroke="var(--text)" strokeWidth="3" strokeOpacity="0.35" />
      <path d="M50 50V17A33 33 0 0 1 79.9 36.05Z" fill="var(--accent)" fillOpacity="0.3" />
      <path d="M50 50L78.5 36.7" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="34" cy="61" r="4.6" fill="var(--accent)" />
      <circle cx="50" cy="50" r="4.2" fill="var(--text)" />
    </svg>
  );
}
