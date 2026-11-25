import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'edge';
export const alt = 'Certificat WESTBOURSE Academy vérifiable';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const NIVEAU_LABEL: Record<string, string> = {
  debutant: 'Niveau 1 — Initiation à la BRVM',
  intermediaire: 'Niveau 2 — Analyse Fondamentale',
  avance: 'Niveau 3 — Analyse Technique',
  expert: 'Niveau 4 — Expert : régulation et marché primaire',
};

export default async function Image(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const db = createPublicClient();
  const { data } = await db
    .from('academy_certificates_public')
    .select('niveau, display_name, issued_at')
    .eq('id', id)
    .maybeSingle();

  const row = data as { niveau?: string; display_name?: string; issued_at?: string } | null;
  const name = row?.display_name ?? 'Certificat Academy';
  const niveau = NIVEAU_LABEL[row?.niveau ?? ''] ?? 'WESTBOURSE Academy';
  const dateText = row?.issued_at
    ? new Date(row.issued_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0b0e14',
          color: '#f5f2eb',
          padding: '44px 56px',
          border: '10px solid #c59b27',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                border: '2px solid #c59b27',
                background: 'rgba(197, 155, 39, 0.14)',
                color: '#e5c45f',
                fontSize: 22,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              WB
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#e5c45f', fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>
                WESTBOURSE ACADEMY
              </span>
              <span style={{ color: '#8f9aad', fontSize: 15 }}>Formation &amp; analyse des marchés UEMOA</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 999,
              border: '1.5px solid rgba(34, 201, 141, 0.45)',
              background: 'rgba(34, 201, 141, 0.14)',
              color: '#46dca4',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            CERTIFICAT VÉRIFIABLE
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 0' }}>
          <span style={{ fontSize: 18, letterSpacing: 4, color: '#8f9aad', textTransform: 'uppercase' }}>
            Attestation de réussite
          </span>
          <div style={{ fontSize: 64, fontWeight: 700, marginTop: 14, color: '#f5f2eb' }}>{name}</div>
          <div style={{ fontSize: 22, marginTop: 14, color: '#a8b3c7' }}>
            a validé l’intégralité du parcours et réussi l’examen de certification
          </div>
          <div style={{ fontSize: 34, marginTop: 18, fontWeight: 700, color: '#e5c45f' }}>{niveau}</div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #263042',
            paddingTop: 18,
            fontSize: 17,
            color: '#8f9aad',
          }}
        >
          <span>{dateText ? `Délivré le ${dateText}` : 'WESTBOURSE · BRVM'}</span>
          <span>westbourse.com/certificat/{id}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
