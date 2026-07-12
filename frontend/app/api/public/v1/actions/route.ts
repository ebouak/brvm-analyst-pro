// GET /api/public/v1/actions
// Liste des actions de la dernière séance. ACCÈS SUR AUTORISATION : clé requise
// (en-tête x-api-key) — demande via /developers, validation admin.
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
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = lastRow?.[0]?.date_marche ?? null;
  if (!date) return apiError('Aucune séance disponible.', 404);

  const { data } = await sb
    .from('brvm_actions_daily')
    .select('code, designation, cours_jour, variation_pct, volume, valeur_echangee')
    .eq('date_marche', date)
    .order('code');

  return apiJson({
    source: 'WESTBOURSE — BRVM',
    date,
    count: data?.length ?? 0,
    actions: (data ?? []).map((a) => ({
      code: a.code,
      nom: a.designation,
      cours: a.cours_jour,
      variation_pct: a.variation_pct,
      volume: a.volume,
      valeur_echangee: a.valeur_echangee,
    })),
  });
}
