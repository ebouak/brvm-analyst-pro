// GET /api/advisor/portfolio
// Conseiller appliqué AUX positions réelles de l'utilisateur (conserver/alléger/
// renforcer), avec P&L. Réutilise le moteur unifié. User-scoped + RLS.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdvisorRecommendations } from '@/lib/advisor/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ logged: false, positions: [] });

  const { data: positions } = await supabase
    .from('portfolios_positions')
    .select('code, quantite, prix_entree')
    .eq('user_id', user.id)
    .gt('quantite', 0);

  if (!positions || positions.length === 0) return NextResponse.json({ logged: true, positions: [] });

  const recos = await getAdvisorRecommendations();
  const byCode = new Map(recos.map((r) => [r.code, r]));

  const rows = positions.map((p) => {
    const reco = byCode.get(p.code);
    const cours = reco?.cours ?? null;
    const valeur = cours != null ? cours * p.quantite : null;
    const pnl = cours != null ? (cours - p.prix_entree) * p.quantite : null;
    const pnlPct = p.prix_entree > 0 && cours != null ? ((cours - p.prix_entree) / p.prix_entree) * 100 : null;
    return {
      code: p.code,
      quantite: p.quantite,
      pru: p.prix_entree,
      cours,
      valeur,
      pnl,
      pnlPct,
      action: reco?.result.action ?? null,
      conviction: reco?.result.conviction ?? null,
      reasons: reco?.result.reasons ?? [],
    };
  });

  return NextResponse.json({ logged: true, positions: rows });
}
