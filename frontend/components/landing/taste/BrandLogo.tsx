export function BrandLogo({ size = 44 }: { size?: number }) {
  const h = (size * 105) / 130;
  return (
    <svg width={size} height={h} viewBox="0 0 130 105" fill="none" aria-label="WESTBOURSE" className="shrink-0">
      <rect x="2" y="2" width="126" height="101" rx="22" fill="#0c1d2e" />
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 82 L100 33" fill="none" stroke="#16b6a4" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="110,12 117,40 86,28" fill="#16b6a4" />
    </svg>
  );
}
