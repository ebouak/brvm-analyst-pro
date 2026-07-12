// GET /api/public/v1/indices
// Indices BRVM de la dernière séance (BRVM-C, BRVM-30, sectoriels).
import { createPublicClient } from '@/lib/supabase/public';
import { apiJson, apiError, requireApiClient, apiOptions } from '@/lib/publicApi';

// Aucun cache de route : la clé et le quota doivent être vérifiés à CHAQUE requête.
export const dynamic = 'force-dynamic';

/** Pré-vol CORS (en-tête x-api-key). */
export async function OPTIONS() {
  return apiOptions();
}

export async function GET(req: Request) {
  const auth = await requireApiClient(req);
  if ('response' in auth) return auth.response;
  const sb = createPublicClient();
  const { data: lastRow } = await sb
    .from('brvm_indices_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = lastRow?.[0]?.date_marche ?? null;
  if (!date) return apiError('Aucune séance disponible.', 404);

  const { data } = await sb
    .from('brvm_indices_daily')
    .select('code, libelle, valeur, variation_pct')
    .eq('date_marche', date)
    .order('code');

  return apiJson({
    source: 'WESTBOURSE — BRVM',
    date,
    indices: (data ?? []).map((i) => ({
      code: i.code,
      nom: i.libelle,
      valeur: i.valeur,
      variation_pct: i.variation_pct,
    })),
  });
}
