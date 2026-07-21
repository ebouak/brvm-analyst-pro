import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation à la BRVM', intermediaire: 'Fondamental', avance: 'Analyse technique', expert: 'Expert' };

export default async function Image({ params }: { params: { id: string } }) {
  const db = createPublicClient();
  const { data } = await db.from('academy_certificates_public').select('niveau, display_name').eq('id', params.id).maybeSingle();
  const name = (data as { display_name?: string } | null)?.display_name ?? 'Certificat';
  const niveau = NIVEAU_LABEL[(data as { niveau?: string } | null)?.niveau ?? ''] ?? 'WESTBOURSE Academy';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#030303', color: '#FCFCFC' }}>
        <div style={{ color: '#56D7FD', fontSize: 28, letterSpacing: 4 }}>WESTBOURSE ACADEMY</div>
        <div style={{ fontSize: 30, marginTop: 40, color: '#7a9ea8' }}>Certificat délivré à</div>
        <div style={{ fontSize: 64, marginTop: 12, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 36, marginTop: 24, color: '#e8b54d' }}>{niveau}</div>
      </div>
    ),
    { ...size },
  );
}
