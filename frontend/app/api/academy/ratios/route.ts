import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { CODE_VALEUR } from '@/lib/academy/carnetReel';
import { ratiosValeurs, type LigneFondamentale } from '@/lib/academy/donneesReelles';

/**
 * Lecture seule : BPA, PER, P/B et ROE d'une valeur, RECALCULÉS par
 * `ratiosValeurs` (le même calcul que les blocs « données réelles ») à partir
 * du dernier cours, du nombre de titres et du dernier exercice publié portant
 * résultat ET fonds propres. Tables en lecture publique, clé anonyme. Cache 1 h.
 * Une valeur sans l'une des trois données renvoie `ratios: null` — jamais un
 * ratio deviné.
 */
export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' };

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') ?? '').toUpperCase();
  if (!CODE_VALEUR.test(code)) return NextResponse.json({ error: 'Code invalide' }, { status: 400 });

  const sb = createPublicClient();
  const [cours, ins, fd] = await Promise.all([
    sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code)
      .gt('cours_jour', 0)
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('brvm_instruments').select('designation, shares').eq('code', code).maybeSingle(),
    sb.from('fundamentals').select('code, year, net_income, equity').eq('code', code),
  ]);
  if (cours.error || ins.error || fd.error) return NextResponse.json({ error: 'Lecture indisponible' }, { status: 502 });

  const c = cours.data as { date_marche: string; cours_jour: number } | null;
  const i = ins.data as { designation: string | null; shares: number | null } | null;
  const fondamentaux = ((fd.data ?? []) as LigneFondamentale[]).map((r) => ({
    ...r,
    net_income: r.net_income == null ? null : Number(r.net_income),
    equity: r.equity == null ? null : Number(r.equity),
  }));
  const r = ratiosValeurs(
    [code],
    { [code]: i?.designation ?? code },
    c ? [{ code, cours: Number(c.cours_jour), date: c.date_marche }] : [],
    fondamentaux,
    { [code]: i?.shares == null ? null : Number(i.shares) },
  );
  return NextResponse.json({ ratios: r.lignes[0] ?? null }, { headers: CACHE });
}
