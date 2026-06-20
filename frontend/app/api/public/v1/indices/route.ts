// GET /api/public/v1/indices
// Indices BRVM de la dernière séance (BRVM-C, BRVM-30, sectoriels).
import { createPublicClient } from '@/lib/supabase/public';
import { apiJson, apiError, checkRateLimit, tooManyRequests } from '@/lib/publicApi';

export const revalidate = 300;

export async function GET(req: Request) {
  if (!checkRateLimit(req)) return tooManyRequests();
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
