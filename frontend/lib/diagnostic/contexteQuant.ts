import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { comparerAuxMedianes, type ComparaisonMedianes, type Pair } from './medianes';

/** Notes des piliers du modèle Combined Alpha pour UNE valeur (0-100). */
export interface PiliersQuant {
  dateCalcul: string;
  combine: number | null;
  valorisation: number | null;
  qualiteResultats: number | null;
  solidite: number | null;
  dividende: number | null;
  momentum: number | null;
  liquidite: number | null;
  classification: string;
  confiance: string;
  rangSecteur: number | null;
}

export interface ContexteQuant {
  medianes: ComparaisonMedianes | null;
  piliers: PiliersQuant | null;
}

interface LigneScore {
  security_id: string;
  raw_metrics_json: Record<string, unknown> | null;
  combined_alpha_score: number | null;
  value_score: number | null;
  earnings_quality_score: number | null;
  financial_strength_score: number | null;
  dividend_quality_score: number | null;
  price_momentum_score: number | null;
  liquidity_score: number | null;
  classification: string;
  confidence_level: string;
  rank_sector: number | null;
}

/**
 * Lit le DERNIER calcul Combined Alpha publié. Tolérant : sans calcul, ou en
 * cas d'erreur, renvoie des nulls et le diagnostic se rédige sans ces sections
 * de contexte — le prompt le dit alors explicitement au modèle.
 */
export async function chargerContexteQuant(
  admin: SupabaseClient,
  code: string,
): Promise<ContexteQuant> {
  const vide: ContexteQuant = { medianes: null, piliers: null };
  try {
    const { data: run } = await admin
      .from('quant_model_runs')
      .select('id, calculation_date')
      .eq('model_code', 'WB_COMBINED_ALPHA')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!run) return vide;

    const { data: scores } = await admin
      .from('quant_model_scores')
      .select(
        'security_id, raw_metrics_json, combined_alpha_score, value_score, earnings_quality_score, ' +
          'financial_strength_score, dividend_quality_score, price_momentum_score, liquidity_score, ' +
          'classification, confidence_level, rank_sector',
      )
      .eq('run_id', run.id);
    if (!scores) return vide;
    // Secteurs lus par CODE et non par `type = 'action'` : cette étiquette n'a
    // pas toujours couvert toutes les valeurs cotées (cf. cron/dossier-polish),
    // et un secteur manquant ferait glisser la valeur hors de son groupe.
    const codes = (scores as unknown as { security_id: string }[]).map((x) => x.security_id);
    const { data: instruments } = await admin
      .from('brvm_instruments')
      .select('code, secteur')
      .in('code', codes);

    const secteurDe = new Map(
      ((instruments ?? []) as { code: string; secteur: string | null }[]).map((i) => [i.code, i.secteur]),
    );
    const lignes = scores as unknown as LigneScore[];
    const univers: Pair[] = lignes.map((s) => ({
      code: s.security_id,
      famille: FAMILLE_PAR_CODE[s.security_id] ?? 'general',
      secteur: secteurDe.get(s.security_id) ?? null,
      metriques: s.raw_metrics_json ?? {},
    }));

    const s = lignes.find((l) => l.security_id === code);
    return {
      medianes: comparerAuxMedianes(code, univers),
      piliers: s
        ? {
            dateCalcul: run.calculation_date as string,
            combine: s.combined_alpha_score,
            valorisation: s.value_score,
            qualiteResultats: s.earnings_quality_score,
            solidite: s.financial_strength_score,
            dividende: s.dividend_quality_score,
            momentum: s.price_momentum_score,
            liquidite: s.liquidity_score,
            classification: s.classification,
            confiance: s.confidence_level,
            rangSecteur: s.rank_sector,
          }
        : null,
    };
  } catch {
    return vide;
  }
}
