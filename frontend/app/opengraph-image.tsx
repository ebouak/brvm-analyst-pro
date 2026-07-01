import { ImageResponse } from 'next/og';

// Image Open Graph générée par code (texte exact, charte WESTBOURSE) —
// Next l'expose automatiquement en og:image ET twitter:image (1200×630).
export const runtime = 'edge';
export const alt = "WESTBOURSE — Décidez sur la BRVM avec des données, pas des rumeurs";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#04121a 0%,#030303 60%)',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* halo cyan */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(86,215,253,0.22), rgba(86,215,253,0) 70%)',
          }}
        />
        {/* marque — logo officiel WESTBOURSE (W + flèche montante) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="66" height="53" viewBox="0 0 130 105" fill="none">
            <rect x="2" y="2" width="126" height="101" rx="22" fill="#0c1d2e" />
            <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M76 82 L100 33" fill="none" stroke="#16b6a4" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points="110,12 117,40 86,28" fill="#16b6a4" />
          </svg>
          <div style={{ color: '#56D7FD', fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>
            WESTBOURSE
          </div>
        </div>

        {/* titre */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ color: '#FCFCFC', fontSize: 62, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
            Décidez sur la BRVM avec des{' '}
            <span style={{ color: '#56D7FD' }}>données</span>, pas des rumeurs.
          </div>
          <div style={{ color: '#7a9ea8', fontSize: 30, fontWeight: 500 }}>
            Cours · Notes A–F · Fondamentaux · Simulateur — Gratuit
          </div>
        </div>

        {/* pied */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              color: '#3fe18b',
              fontSize: 24,
              fontWeight: 700,
              border: '1px solid rgba(63,225,139,0.35)',
              borderRadius: 999,
              padding: '8px 22px',
            }}
          >
            BRVM · UEMOA
          </div>
          <div style={{ color: '#4a7a85', fontSize: 24 }}>Analyse quantitative, pas d&apos;opinion</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
