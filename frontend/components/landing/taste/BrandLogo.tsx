export function BrandLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-label="BRVM Analyst Pro" className="shrink-0">
      <rect x="1" y="1" width="50" height="50" rx="16" fill="rgba(208,162,49,0.08)" stroke="rgba(208,162,49,0.3)" />
      <circle cx="26" cy="26" r="18" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 5" />
      <path d="M13 33L20 26L25 30L38 17" stroke="#f4d57b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 17H38V24" stroke="#f4d57b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
