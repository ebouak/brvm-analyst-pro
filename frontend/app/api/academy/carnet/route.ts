import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { CODE_VALEUR } from '@/lib/academy/carnetReel';

/**
 * Lecture seule : DERNIÈRE ligne du carnet publié (Bulletin officiel de la
 * cote) pour une valeur. Clé anonyme, table en lecture publique. Cache 1 h :
 * le bulletin n'est publié qu'une fois par séance.
 */
export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' };

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') ?? '').toUpperCase();
  if (!CODE_VALEUR.test(code)) return NextResponse.json({ error: 'Code invalide' }, { status: 400 });

  const { data, error } = await createPublicClient()
    .from('brvm_carnet_daily')
    .select('code, date_marche, designation, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche, cours_reference')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Une panne n'est jamais présentée comme « aucune donnée ».
  if (error) return NextResponse.json({ error: 'Lecture indisponible' }, { status: 502 });
  return NextResponse.json({ carnet: data ?? null }, { headers: CACHE });
}
