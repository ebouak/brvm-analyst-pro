import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { construireSyntheseBacktest } from './backtesting';
import type { LimitesMethodologiquesBacktest, ResultatStrategie, StatSeuilBacktest, SyntheseBacktest } from './backtestingTypes';
import type { PointIndice } from './types';

const PAGE = 1000;

export type IndiceBacktestAutorise = 'BRVMC' | 'BRVM30' | 'BRVMPRES';

async function lireSerieIndiceConsolidée(indiceCode: IndiceBacktestAutorise): Promise<PointIndice[]> {
  const sb = getServiceClient();

  const lire = async (table: 'stress_indices_history' | 'brvm_indices_daily') => {
    const out: Array<{ date_marche: string; valeur: number; variation_pct: number | null }> = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await sb
        .from(table)
        .select('date_marche, valeur, variation_pct')
        .eq('code', indiceCode)
        .order('date_marche', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) return out;
      const rows = (data ?? []) as typeof out;
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  };

  const [hist, off] = await Promise.all([
    lire('stress_indices_history'),
    lire('brvm_indices_daily'),
  ]);

  const map = new Map<string, PointIndice>();
  for (const r of hist) {
    if (Number(r.valeur) > 0) {
      const d = String(r.date_marche).slice(0, 10);
      map.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    }
  }
  for (const r of off) {
    if (Number(r.valeur) > 0) {
      const d = String(r.date_marche).slice(0, 10);
      map.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    }
  }
  return [...map.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));
}

/**
 * Charge le backtesting historique côté serveur (après `canAccess('stress_backtest')`).
 * Lit le dernier snapshot pré-calculé dans `stress_backtest_snapshots` si les paramètres
 * correspondent, sinon calcule en direct sur la série consolidée `stress_indices_history` + `brvm_indices_daily`.
 */
export async function chargerBacktestStress(
  opts: {
    indiceCode?: IndiceBacktestAutorise;
    fraisPct?: number;
    clusteringJours?: number;
  } = {},
): Promise<SyntheseBacktest> {
  const indiceCode: IndiceBacktestAutorise = opts.indiceCode ?? 'BRVMC';
  const fraisPct = Math.round((opts.fraisPct ?? 1.5) * 10_000) / 10_000;
  const clusteringJours = Math.round(opts.clusteringJours ?? 90);

  const sb = getServiceClient();

  const { data: snap, error } = await sb
    .from('stress_backtest_snapshots')
    .select('*')
    .eq('indice_code', indiceCode)
    .eq('frais_aller_retour_pct', fraisPct)
    .eq('mode_clustering_jours', clusteringJours)
    .order('date_calcul', { ascending: false })
    .limit(1);

  if (!error && snap && snap[0]) {
    const r = snap[0] as {
      date_calcul: string;
      indice_code: string;
      debut_serie: string | null;
      fin_serie: string | null;
      nb_seances: number;
      drawdown_actuel_pct: number | null;
      frais_aller_retour_pct: number;
      mode_clustering_jours: number;
      stats_seuils: StatSeuilBacktest[];
      strategies: ResultatStrategie[];
      limites_methodologiques: LimitesMethodologiquesBacktest;
    };
    return {
      date_calcul: String(r.date_calcul).slice(0, 10),
      indice_code: r.indice_code,
      source_mode: 'table_precalculee',
      debut_serie: r.debut_serie ? String(r.debut_serie).slice(0, 10) : null,
      fin_serie: r.fin_serie ? String(r.fin_serie).slice(0, 10) : null,
      nb_seances: Number(r.nb_seances ?? 0),
      drawdown_actuel_pct: r.drawdown_actuel_pct != null ? Number(r.drawdown_actuel_pct) : null,
      frais_aller_retour_pct: Number(r.frais_aller_retour_pct),
      mode_clustering_jours: Number(r.mode_clustering_jours),
      stats_seuils: Array.isArray(r.stats_seuils) ? r.stats_seuils : [],
      strategies: Array.isArray(r.strategies) ? r.strategies : [],
      limites_methodologiques: r.limites_methodologiques,
    };
  }

  // Repli gracieux en direct (avant application de 0278 ou pour paramètres personnalisés)
  const serie = await lireSerieIndiceConsolidée(indiceCode);
  return construireSyntheseBacktest(serie, {
    indiceCode,
    fraisAllerRetourPct: fraisPct,
    clusteringJours,
    sourceMode: 'calcul_live',
    raisonIndisponibiliteStrat4:
      indiceCode !== 'BRVMC'
        ? 'Portefeuille multi-valeurs calculé uniquement pour le référentiel BRVMC.'
        : 'Mode calcul direct : exécutez le pré-calcul CLI `stress:backtest` pour activer la Stratégie 4.',
  });
}
