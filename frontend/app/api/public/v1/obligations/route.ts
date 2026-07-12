// GET /api/public/v1/obligations
// Obligations cotées de la dernière séance + YTM/duration dérivés (lib/bonds).
import { createPublicClient } from '@/lib/supabase/public';
import { yieldToMaturity, durations, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import { apiJson, apiError, requireApiClient, apiOptions } from '@/lib/publicApi';
import type { ObligationDaily } from '@/lib/types';

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
    .from('brvm_obligations_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = lastRow?.[0]?.date_marche ?? null;
  if (!date) return apiError('Aucune séance disponible.', 404);

  const { data } = await sb.from('brvm_obligations_daily').select('*').eq('date_marche', date);

  const obligations = ((data ?? []) as ObligationDaily[]).map((o) => {
    const parsed = parseObligationDesignation(o.designation);
    const emetteur = o.emetteur ?? parsed.emetteur;
    const tauxPct = o.taux_pct ?? parsed.couponPct;
    const maturite = o.maturite ?? parsed.maturite;
    const years = yearsTo(maturite);
    let ytm: number | null = null;
    let modifiedDuration: number | null = null;
    if (o.cours_jour != null && tauxPct != null && years != null) {
      const inputs = { prix: o.cours_jour, couponRatePct: tauxPct, yearsToMaturity: years, face: 100 };
      ytm = yieldToMaturity(inputs);
      if (ytm != null) modifiedDuration = durations(inputs, ytm)?.modified ?? null;
    }
    return {
      code: o.code,
      designation: o.designation,
      emetteur,
      taux_coupon_pct: tauxPct,
      maturite,
      cours: o.cours_jour,
      volume: o.volume,
      ytm_pct: ytm,
      duration_modifiee: modifiedDuration,
    };
  });

  return apiJson({ source: 'WESTBOURSE — BRVM', date, count: obligations.length, obligations });
}
