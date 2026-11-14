import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { CODE_VALEUR } from '@/lib/academy/carnetReel';

/**
 * Lecture seule : clôtures RÉELLES d'une valeur sur environ quinze mois
 * (`brvm_actions_daily`, lecture publique), pour les simulateurs techniques des
 * leçons (moyennes mobiles, RSI, MACD, variation par horizon). Clé anonyme.
 * Cache 1 h : une clôture ne change qu'une fois par séance.
 *
 * Zéros et cours absents sont écartés (trous de collecte, pas des cours).
 * Moins de 1000 lignes par construction (une valeur, ~320 séances) : pas de
 * troncature silencieuse de PostgREST.
 */
export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' };
const JOURS = 460;

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') ?? '').toUpperCase();
  if (!CODE_VALEUR.test(code)) return NextResponse.json({ error: 'Code invalide' }, { status: 400 });

  const sb = createPublicClient();
  const depuis = new Date(Date.now() - JOURS * 86_400_000).toISOString().slice(0, 10);
  const [cours, ins] = await Promise.all([
    sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code)
      .gte('date_marche', depuis)
      .order('date_marche', { ascending: true })
      .limit(1000),
    sb.from('brvm_instruments').select('designation').eq('code', code).maybeSingle(),
  ]);

  // Une panne n'est jamais présentée comme « aucune donnée ».
  if (cours.error || ins.error) return NextResponse.json({ error: 'Lecture indisponible' }, { status: 502 });

  const points = ((cours.data ?? []) as { date_marche: string; cours_jour: number | null }[])
    .filter((r) => r.cours_jour != null && Number(r.cours_jour) > 0)
    .map((r) => ({ date: r.date_marche, cours: Number(r.cours_jour) }));
  const nom = (ins.data as { designation: string | null } | null)?.designation ?? null;
  return NextResponse.json({ code, nom, points }, { headers: CACHE });
}
