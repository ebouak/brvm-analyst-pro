import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { HebdoCard } from '@/lib/hebdo/card';

export const runtime = 'edge';

/** PNG 2400×1260 d'une valeur de l'édition. GET /api/hebdo/2026-07-21/image?code=ETIT */
export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const code = (new URL(req.url).searchParams.get('code') ?? '').toUpperCase().slice(0, 8);
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id').eq('date_edition', params.date).maybeSingle();
  if (!ed) return new Response('Introuvable', { status: 404 });
  const editionId = (ed as { id: string }).id;
  const base = db.from('hebdo_items').select('code, metrics').eq('edition_id', editionId);
  const { data: items } = code
    ? await base.eq('code', code).limit(1)
    : await base.order('ordre').limit(1);
  const it = (items ?? [])[0] as { code: string; metrics: { dernier: number; variationHebdo: number | null; rsiDernier: number | null; closes: number[] } } | undefined;
  if (!it) return new Response('Introuvable', { status: 404 });
  const d = {
    code: it.code, dernier: it.metrics.dernier, variation: it.metrics.variationHebdo,
    rsi: it.metrics.rsiDernier, date: params.date, closes: it.metrics.closes?.slice(-40) ?? [],
  };
  return new ImageResponse(<HebdoCard d={d} scale={2} />, { width: 2400, height: 1260 });
}
