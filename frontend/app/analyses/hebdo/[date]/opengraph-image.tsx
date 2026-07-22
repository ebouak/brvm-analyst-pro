import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { HebdoCard } from '@/lib/hebdo/card';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { date: string } }) {
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id').eq('date_edition', params.date).maybeSingle();
  const { data: items } = ed
    ? await db.from('hebdo_items').select('code, metrics').eq('edition_id', (ed as { id: string }).id).order('ordre').limit(1)
    : { data: [] };
  const it = (items ?? [])[0] as { code: string; metrics: { dernier: number; variationHebdo: number | null; rsiDernier: number | null; closes: number[] } } | undefined;
  const d = {
    code: it?.code ?? 'BRVM',
    dernier: it?.metrics.dernier ?? 0,
    variation: it?.metrics.variationHebdo ?? null,
    rsi: it?.metrics.rsiDernier ?? null,
    date: params.date,
    closes: it?.metrics.closes?.slice(-40) ?? [],
  };
  return new ImageResponse(<HebdoCard d={d} scale={1} />, { ...size });
}
