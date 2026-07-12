// GET /api/public/v1/actions/[code]
// Cours actuel + historique récent (90 dernières séances) d'une action BRVM.
import { createPublicClient } from '@/lib/supabase/public';
import { apiJson, apiError, requireApiClient, apiOptions } from '@/lib/publicApi';

// Aucun cache de route : la clé et le quota doivent être vérifiés à CHAQUE requête.
export const dynamic = 'force-dynamic';

/** Pré-vol CORS (en-tête x-api-key). */
export async function OPTIONS() {
  return apiOptions();
}

export async function GET(req: Request, { params }: { params: { code: string } }) {
  const auth = await requireApiClient(req);
  if ('response' in auth) return auth.response;
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
