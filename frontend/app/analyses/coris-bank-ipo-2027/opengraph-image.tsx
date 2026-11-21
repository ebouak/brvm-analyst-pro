import { ImageResponse } from 'next/og';

export const alt = 'OPV Coris Bank International Côte d’Ivoire : étude WESTBOURSE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#f1ede3',
          color: '#171612',
          padding: '48px 56px',
          fontFamily: 'Georgia, serif',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '14px solid #171612',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700 }}>
          <span>WESTBOURSE RECHERCHE</span>
          <span style={{ color: '#076880' }}>OPV · VALORISATION · BRVM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 740 }}>
            <span style={{ color: '#076880', fontSize: 22, letterSpacing: 4 }}>20 NOVEMBRE 2026</span>
            <strong style={{ fontSize: 82, lineHeight: 0.93, letterSpacing: -4 }}>
              CBI CI : 20 % à 7 720 FCFA.
            </strong>
            <span style={{ marginTop: 20, fontSize: 31, lineHeight: 1.2, color: '#625e54' }}>
              315 Md de valorisation, 12,8× le résultat 2025.
            </span>
          </div>
          <div
            style={{
              width: 275,
              height: 275,
              borderRadius: 999,
              background: '#171612',
              color: '#f1ede3',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: '3px solid #76d3dc',
            }}
          >
            <span style={{ fontSize: 18, letterSpacing: 3 }}>MONTANT OFFERT</span>
            <strong style={{ fontSize: 60, letterSpacing: -4 }}>62,7 Md</strong>
            <span style={{ fontSize: 18 }}>5,7× une séance</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #171612', paddingTop: 16, fontSize: 20 }}>
          <span>Souscription 30 nov. – 4 déc. · Cotation 15 janv. 2027</span>
          <span>westbourse.com</span>
        </div>
      </div>
    ),
    size,
  );
}
