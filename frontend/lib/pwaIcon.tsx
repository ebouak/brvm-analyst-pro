/**
 * Marque WESTBOURSE (W + flèche montante) rendue en icône carrée pour les
 * icônes PWA (manifest + apple-touch-icon), via next/og ImageResponse. Fond
 * plein (maskable-safe : la marque reste dans la zone centrale sûre, l'OS peut
 * masquer les bords sans rogner le logo).
 */
export function BrandIcon({ size }: { size: number }) {
  const markW = Math.round(size * 0.6);
  const markH = Math.round((markW * 105) / 130);
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0c1d2e',
      }}
    >
      <svg width={markW} height={markH} viewBox="0 0 130 105" fill="none">
        <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M76 82 L100 33" fill="none" stroke="#16b6a4" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="110,12 117,40 86,28" fill="#16b6a4" />
      </svg>
    </div>
  );
}
