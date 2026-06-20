// GET /api/public/v1/actions/[code]
// Cours actuel + historique récent (90 dernières séances) d'une action BRVM.
import { createPublicClient } from '@/lib/supabase/public';
import { apiJson, apiError } from '@/lib/publicApi';

export const revalidate = 300;

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const sb = createPublicClient();

  const { data: hist } = await sb
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour, variation_pct, volume')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(90);

  if (!hist || hist.length === 0) return apiError(`Action « ${code} » introuvable.`, 404);

  const latest = hist[0]!;
  return apiJson({
    source: 'WESTBOURSE — BRVM',
    code,
    cours: latest.cours_jour,
    variation_pct: latest.variation_pct,
    date: latest.date_marche,
    historique: hist
      .slice()
      .reverse()
      .map((h) => ({ date: h.date_marche, cours: h.cours_jour, variation_pct: h.variation_pct, volume: h.volume })),
  });
}
