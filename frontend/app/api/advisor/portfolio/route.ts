// GET /api/advisor/portfolio
// Positions réelles de l'utilisateur, avec P&L et leur position par famille de
// facteurs (conseiller_facteurs). Aucun verdict. User-scoped + RLS.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { lirePositions } from '@/lib/conseiller/lecture';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ logged: false, positions: [] });

  const { data: positions, error } = await supabase
    .from('portfolios_positions')
    .select('code, quantite, prix_entree')
    .eq('user_id', user.id)
    .gt('quantite', 0);

  if (error) return NextResponse.json({ logged: true, erreur: true, positions: [] });
  if (!positions || positions.length === 0) return NextResponse.json({ logged: true, positions: [] });

  try {
    const lues = await lirePositions();
    const parCode = new Map((lues?.lignes ?? []).map((l) => [l.code, l]));

    // Dernier cours de chaque code détenu.
    const codes = Array.from(new Set(positions.map((p) => p.code as string)));
    const pub = createPublicClient();
    const { data: der, error: e1 } = await pub
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1);
    if (e1) throw new Error(e1.message);
    const dateCours = der?.[0]?.date_marche as string | undefined;
    const cours = new Map<string, number | null>();
    if (dateCours) {
      const { data: cx, error: e2 } = await pub
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .eq('date_marche', dateCours)
        .in('code', codes);
      if (e2) throw new Error(e2.message);
      for (const r of (cx ?? []) as { code: string; cours_jour: number | null }[]) cours.set(r.code, r.cours_jour);
    }

    const rows = positions.map((p) => {
      const c = cours.get(p.code) ?? null;
      const valeur = c != null ? c * p.quantite : null;
      const pnl = c != null ? (c - p.prix_entree) * p.quantite : null;
      const pnlPct = p.prix_entree > 0 && c != null ? ((c - p.prix_entree) / p.prix_entree) * 100 : null;
      const f = parCode.get(p.code);
      return {
        code: p.code,
        quantite: p.quantite,
        pru: p.prix_entree,
        cours: c,
        valeur,
        pnl,
        pnlPct,
        tiers: f?.tiers ?? {},
        classe_liquidite: f?.classe_liquidite ?? null,
      };
    });

    return NextResponse.json({ logged: true, positions: rows });
  } catch {
    return NextResponse.json({ logged: true, erreur: true, positions: [] });
  }
}
