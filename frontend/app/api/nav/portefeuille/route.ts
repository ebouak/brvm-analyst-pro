// Aperçu PRIVÉ du portefeuille pour la barre de cote : valeur, variation du
// jour et nombre d'alertes actives. Lu avec la session de l'appelant (RLS
// owner) ; jamais mis en cache partagé. Une lecture d'alertes en échec n'est
// pas un zéro : la ligne est simplement absente.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apercuPortefeuille, type PositionValorisee } from '@/lib/barreDeCote';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ erreur: 'non connecté' }, { status: 401, headers: PRIVE });

    const [{ data: positions }, alertes] = await Promise.all([
      db.from('portfolios_positions').select('code, quantite').eq('user_id', user.id),
      db.from('alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('actif', true),
    ]);
    const alertesActives = alertes.error ? null : (alertes.count ?? null);
    const pos = (positions ?? []) as { code: string; quantite: number }[];
    if (pos.length === 0) return NextResponse.json({ apercu: apercuPortefeuille([], alertesActives) }, { headers: PRIVE });

    const { data: der } = await db.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const date = der?.[0]?.date_marche as string | undefined;
    const codes = [...new Set(pos.map((p) => p.code))];
    const { data: cours } = date
      ? await db.from('brvm_actions_daily').select('code, cours_jour, variation_pct').eq('date_marche', date).in('code', codes)
      : { data: [] };
    const parCode = new Map((cours ?? []).map((c: { code: string; cours_jour: number | null; variation_pct: number | null }) => [c.code, c]));
    const valorisees: PositionValorisee[] = pos.map((p) => ({
      quantite: Number(p.quantite) || 0,
      cours: parCode.get(p.code)?.cours_jour ?? null,
      variation_pct: parCode.get(p.code)?.variation_pct ?? null,
    }));
    return NextResponse.json({ apercu: apercuPortefeuille(valorisees, alertesActives) }, { headers: PRIVE });
  } catch {
    return NextResponse.json({ erreur: 'indisponible' }, { status: 503, headers: PRIVE });
  }
}
