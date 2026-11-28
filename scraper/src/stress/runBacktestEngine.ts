/**
 * Runner CLI Phase 3 — Historical Backtesting Engine (`npm run stress:backtest`).
 * Calcule les statistiques de rebond post-correction (1/3/6/12/24M, IC bootstrap 95 %)
 * et les 4 stratégies historiques anti-biais (y compris portefeuille valeurs résilientes 2022+),
 * puis upsert dans `stress_backtest_snapshots`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { ajusterSerieActions, parserPariteFractionnement, type CoursBrutAction, type SplitConnu } from './pure/adjustments.js';
import { construireSyntheseBacktest } from './pure/backtesting.js';
import type { PortefeuilleResilientActionInput, SyntheseBacktest } from './pure/backtestingTypes.js';
import type { PointIndice } from './pure/types.js';

const PAGE = 1000;
const INDICES_CIBLES = ['BRVMC', 'BRVM30', 'BRVMPRES'] as const;

export interface BacktestRunResult {
  status: 'success' | 'mock' | 'failed';
  indices_traites: number;
  snapshots_ecrits: number;
  details: Array<{
    indice_code: string;
    date_calcul: string;
    nb_seances: number;
    nb_seuils: number;
    strat4_disponible: boolean;
  }>;
  raison?: string;
}

async function lirePage<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await fetchPage(offset, offset + PAGE - 1);
    if (error) throw new Error(`lecture ${label} : ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function fixtureMock(): { indice: PointIndice[]; actions: PortefeuilleResilientActionInput[] } {
  const dates: string[] = [];
  let t = Date.UTC(2007, 0, 2);
  while (dates.length < 4800) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
    t += 86_400_000;
  }

  // Série synthétique 20 ans incluant plusieurs phases baissières (2008, 2016-2020, 2022, 2026)
  let val = 250;
  const indice: PointIndice[] = dates.map((d, i) => {
    if (i >= 350 && i < 550) val *= 0.9968;
    else if (i >= 550 && i < 950) val *= 1.0018;
    else if (i >= 2200 && i < 2900) val *= 0.9989;
    else if (i >= 2900 && i < 3900) val *= 1.0014;
    else if (i >= 4650) val *= 0.9986;
    else val *= 1.0005 + 0.002 * Math.sin(i / 25);
    return { date_marche: d, valeur: Math.round(val * 100) / 100 };
  });

  const datesRecent = dates.filter((d) => d >= '2021-01-01');
  const codes = ['SNTS', 'SGBC', 'ORAC', 'ONTBF', 'SIBC'] as const;
  const actions: PortefeuilleResilientActionInput[] = codes.map((code, idx) => ({
    code,
    designation: `${code} Mock`,
    cours: datesRecent.map((d, i) => ({
      date_marche: d,
      cours_ajuste: Math.round((4000 + idx * 900) * (1 + 0.0003 * i + 0.04 * Math.sin(i / 35 + idx))),
    })),
    fondamentaux: [2020, 2021, 2022, 2023, 2024, 2025].map((y) => ({
      exercice: y,
      resultat_net: (15 + idx * 3) * 1e9,
      capitaux_propres: 100e9,
      date_publication: null,
    })),
    dividendes: [2020, 2021, 2022, 2023, 2024, 2025].map((y) => ({
      exercice: y,
      montant_net: 250 + idx * 40,
      ex_date: null,
    })),
  }));

  return { indice, actions };
}

export async function runBacktestEngine(
  opts: {
    mock?: boolean;
    dryRun?: boolean;
    indiceCode?: string;
    fraisPct?: number;
    clusteringJours?: number;
  } = {},
): Promise<BacktestRunResult> {
  const mock = Boolean(opts.mock);
  const dryRun = opts.dryRun ?? (!mock && getConfig().DRY_RUN);
  const fraisPct = opts.fraisPct ?? 1.5;
  const clusteringJours = opts.clusteringJours ?? 90;

  if (mock) {
    const { indice, actions } = fixtureMock();
    const synth = construireSyntheseBacktest(indice, {
      indiceCode: 'BRVMC',
      fraisAllerRetourPct: fraisPct,
      clusteringJours,
      actionsStrategie4: actions,
    });
    logger.info(
      {
        indice: synth.indice_code,
        seances: synth.nb_seances,
        seuils: synth.stats_seuils.length,
        strategies: synth.strategies.filter((s) => s.disponible).length,
      },
      '[mock] Historical Backtesting Engine exécuté',
    );
    return {
      status: 'mock',
      indices_traites: 1,
      snapshots_ecrits: 0,
      details: [
        {
          indice_code: synth.indice_code,
          date_calcul: synth.date_calcul,
          nb_seances: synth.nb_seances,
          nb_seuils: synth.stats_seuils.length,
          strat4_disponible: synth.strategies.find((s) => s.id === 'portefeuille_resilient')?.disponible ?? false,
        },
      ],
    };
  }

  const sb: SupabaseClient = getSupabase();
  const cibles = opts.indiceCode ? [opts.indiceCode.toUpperCase()] : [...INDICES_CIBLES];

  const [indicesOff, indicesHist, instruments, profils, opsTitres, coursActionsRaw, incRaw, balRaw, divsRaw] =
    await Promise.all([
      lirePage<{ code: string; date_marche: string; valeur: number; variation_pct: number | null }>(
        (from, to) =>
          sb
            .from('brvm_indices_daily')
            .select('code, date_marche, valeur, variation_pct')
            .in('code', cibles)
            .order('date_marche', { ascending: true })
            .order('code', { ascending: true }) // tri total : plusieurs indices partagent une date
            .range(from, to),
        'brvm_indices_daily',
      ),
      lirePage<{ code: string; date_marche: string; valeur: number; variation_pct: number | null }>(
        (from, to) =>
          sb
            .from('stress_indices_history')
            .select('code, date_marche, valeur, variation_pct')
            .in('code', cibles)
            .order('date_marche', { ascending: true })
            .order('code', { ascending: true }) // tri total : plusieurs indices partagent une date
            .range(from, to),
        'stress_indices_history',
      ), // Sans .catch : une lecture en échec fait échouer le run (avant, historique tronqué et run vert).
      lirePage<{ code: string; designation: string }>(
        (from, to) => sb.from('brvm_instruments').select('code, designation').eq('type', 'action').range(from, to),
        'brvm_instruments',
      ),
      lirePage<{ code: string; identite: { fractionnements?: Array<{ date?: string; parite?: string }> } | null }>(
        (from, to) => sb.from('societes_profils').select('code, identite').range(from, to),
        'societes_profils',
      ),
      lirePage<{ code: string; date_effet: string; ratio: number }>(
        (from, to) => sb.from('operations_titres').select('code, date_effet, ratio').range(from, to),
        'operations_titres',
      ),
      lirePage<{ code: string; date_marche: string; cours_jour: number | null; variation_pct: number | null; volume: number | null; valeur_echangee: number | null }>(
        (from, to) =>
          sb
            .from('brvm_actions_daily')
            .select('code, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
            .gte('date_marche', '2021-01-01')
            .order('date_marche', { ascending: true })
            .order('code', { ascending: true })
            .range(from, to),
        'brvm_actions_daily',
      ),
      lirePage<{ code: string; periode: string; resultat_net: number | null }>(
        (from, to) => sb.from('income_statements').select('code, periode, resultat_net').order('code').order('periode').range(from, to),
        'income_statements',
      ),
      lirePage<{ code: string; periode: string; total_capitaux_propres: number | null }>(
        (from, to) => sb.from('balance_sheets').select('code, periode, total_capitaux_propres').order('code').order('periode').range(from, to),
        'balance_sheets',
      ),
      lirePage<{ code: string; exercice: number | null; ex_date: string | null; montant: number; base_fiscale: string | null }>(
        (from, to) => sb.from('dividends').select('code, exercice, ex_date, montant, base_fiscale').range(from, to),
        'dividends',
      ),
    ]);

  // Fusionner séries d'indices (brvm_indices_daily prioritaire)
  const parIndice = new Map<string, Map<string, PointIndice>>();
  for (const r of indicesHist) {
    if (!(Number(r.valeur) > 0)) continue;
    const m = parIndice.get(r.code) ?? new Map<string, PointIndice>();
    const d = String(r.date_marche).slice(0, 10);
    m.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    parIndice.set(r.code, m);
  }
  for (const r of indicesOff) {
    if (!(Number(r.valeur) > 0)) continue;
    const m = parIndice.get(r.code) ?? new Map<string, PointIndice>();
    const d = String(r.date_marche).slice(0, 10);
    m.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    parIndice.set(r.code, m);
  }

  // Préparer les entrées ajustées pour la stratégie 4 (sans look-ahead)
  const profilMap = new Map(profils.map((p) => [p.code, p.identite]));
  const groupByCode = <T extends { code: string }>(arr: readonly T[]) => {
    const m = new Map<string, T[]>();
    for (const x of arr) {
      const l = m.get(x.code) ?? [];
      l.push(x);
      m.set(x.code, l);
    }
    return m;
  };
  const coursByCode = groupByCode(coursActionsRaw);
  const opsByCode = groupByCode(opsTitres);
  const incByCode = groupByCode(incRaw);
  const balByCode = groupByCode(balRaw);
  const divByCode = groupByCode(divsRaw);

  const actionsStrategie4: PortefeuilleResilientActionInput[] = [];
  for (const inst of instruments) {
    const brut = (coursByCode.get(inst.code) ?? []) as CoursBrutAction[];
    if (brut.length === 0) continue;

    const splitMap = new Map<string, SplitConnu>();
    for (const f of profilMap.get(inst.code)?.fractionnements ?? []) {
      const ratio = parserPariteFractionnement(f.parite);
      if (f.date && ratio && ratio > 1) splitMap.set(f.date, { date_effet: f.date, ratio, source: 'societes_profils' });
    }
    for (const o of opsByCode.get(inst.code) ?? []) {
      splitMap.set(o.date_effet.slice(0, 10), { date_effet: o.date_effet.slice(0, 10), ratio: Number(o.ratio), source: 'operations_titres' });
    }
    const adj = ajusterSerieActions(inst.code, brut, [...splitMap.values()]);

    const eqByYear = new Map<number, number | null>();
    for (const b of balByCode.get(inst.code) ?? []) {
      const yr = Number(String(b.periode).slice(0, 4));
      if (Number.isInteger(yr)) eqByYear.set(yr, b.total_capitaux_propres != null ? Number(b.total_capitaux_propres) : null);
    }
    const fondMap = new Map<number, { exercice: number; resultat_net: number | null; capitaux_propres: number | null; date_publication: null }>();
    for (const ic of incByCode.get(inst.code) ?? []) {
      const yr = Number(String(ic.periode).slice(0, 4));
      if (!Number.isInteger(yr)) continue;
      fondMap.set(yr, {
        exercice: yr,
        resultat_net: ic.resultat_net != null ? Number(ic.resultat_net) : null,
        capitaux_propres: eqByYear.get(yr) ?? null,
        date_publication: null,
      });
    }

    actionsStrategie4.push({
      code: inst.code,
      designation: inst.designation,
      cours: adj.serieAjustee.map((c) => ({ date_marche: c.date_marche, cours_ajuste: c.cours_ajuste })),
      fondamentaux: [...fondMap.values()],
      dividendes: (divByCode.get(inst.code) ?? [])
        .filter((d) => d.exercice != null)
        .map((d) => ({
          exercice: Number(d.exercice),
          montant_net: d.base_fiscale === 'brut' ? null : Number(d.montant),
          ex_date: d.ex_date ? String(d.ex_date).slice(0, 10) : null,
        })),
    });
  }

  const syntheses: SyntheseBacktest[] = [];
  for (const code of cibles) {
    const ptsMap = parIndice.get(code);
    if (!ptsMap || ptsMap.size === 0) continue;
    const serie = [...ptsMap.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));
    syntheses.push(
      construireSyntheseBacktest(serie, {
        indiceCode: code,
        fraisAllerRetourPct: fraisPct,
        clusteringJours,
        actionsStrategie4: code === 'BRVMC' ? actionsStrategie4 : undefined,
        sourceMode: 'table_precalculee',
      }),
    );
  }

  if (syntheses.length === 0) {
    return { status: 'failed', indices_traites: 0, snapshots_ecrits: 0, details: [], raison: 'Aucune série indice disponible' };
  }

  let ecrits = 0;
  if (!dryRun) {
    const now = new Date().toISOString();
    const payload = syntheses.map((s) => ({
      date_calcul: s.date_calcul,
      indice_code: s.indice_code,
      frais_aller_retour_pct: s.frais_aller_retour_pct,
      mode_clustering_jours: s.mode_clustering_jours,
      debut_serie: s.debut_serie,
      fin_serie: s.fin_serie,
      nb_seances: s.nb_seances,
      drawdown_actuel_pct: s.drawdown_actuel_pct,
      stats_seuils: s.stats_seuils,
      strategies: s.strategies,
      limites_methodologiques: s.limites_methodologiques,
      methode_version: '1.0',
      updated_at: now,
    }));
    const { error } = await sb
      .from('stress_backtest_snapshots')
      .upsert(payload, { onConflict: 'date_calcul,indice_code,frais_aller_retour_pct,mode_clustering_jours' });
    if (error) throw new Error(`upsert stress_backtest_snapshots : ${error.message}`);
    ecrits = payload.length;
  }

  return {
    status: 'success',
    indices_traites: syntheses.length,
    snapshots_ecrits: ecrits,
    details: syntheses.map((s) => ({
      indice_code: s.indice_code,
      date_calcul: s.date_calcul,
      nb_seances: s.nb_seances,
      nb_seuils: s.stats_seuils.length,
      strat4_disponible: s.strategies.find((st) => st.id === 'portefeuille_resilient')?.disponible ?? false,
    })),
  };
}
