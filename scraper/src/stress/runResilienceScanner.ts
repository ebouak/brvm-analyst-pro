/**
 * Runner CLI Phase 2 — Stock Resilience Scanner (`npm run stress:resilience`).
 * Calcule l'analyse individuelle des 48+ valeurs BRVM (performances ajustées,
 * résistance, décrochages anormaux, fondamentaux sectorisés, scoring 0-100) et
 * upsert dans `stress_resilience_daily`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { ajusterSerieActions, parserPariteFractionnement, type CoursBrutAction, type SplitConnu } from './pure/adjustments.js';
import {
  agregerSecteursStress,
  calculerResilienceUnivers,
  type BalanceInput,
  type CashFlowInput,
  type DividendInput,
  type EventInput,
  type IncomeInput,
  type IndicateurBancaireInput,
  type LiquidityInput,
  type ResilienceInputAction,
} from './pure/resilience.js';
import type { FamilleComptable } from './pure/resilienceTypes.js';
import type { PointIndice } from './pure/types.js';

const PAGE = 1000;
const BATCH = 100;

export interface ResilienceRunResult {
  status: 'success' | 'mock' | 'failed';
  date_marche: string | null;
  nb_valeurs: number;
  nb_decrochages: number;
  nb_ecrites: number;
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

function fixtureMock(): { inputs: ResilienceInputAction[]; indice: PointIndice[] } {
  const dates: string[] = [];
  let t = Date.UTC(2025, 10, 1);
  while (dates.length < 260) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
    t += 86_400_000;
  }

  const indice: PointIndice[] = dates.map((d, i) => ({
    date_marche: d,
    valeur: i < 200 ? 300 + i * 0.6 : 420 - (i - 200) * 1.1,
  }));

  const mkSerie = (fn: (i: number) => number, vol = 1000): CoursBrutAction[] =>
    dates.map((d, i) => ({
      date_marche: d,
      cours_jour: Math.round(fn(i)),
      volume: vol,
    }));

  const inputs: ResilienceInputAction[] = [
    {
      instrument: { code: 'SNTS', designation: 'SONATEL', secteur: 'Télécommunications', pays: 'Sénégal', famille_comptable: 'general', actif: true, shares: 1_000_000_000, isin: 'SN0000000019', date_introduction: '1998-10-02' },
      cours: ajusterSerieActions('SNTS', mkSerie((i) => (i < 200 ? 4000 + i * 3 : 4600 - (i - 200) * 3), 25000), []).serieAjustee,
      ajustements: [],
      anomaliesCours: [],
      income: [{ code: 'SNTS', periode: '2025', revenu_total: 1800e9, resultat_exploitation: 650e9, resultat_net: 413e9, charges_financieres_nettes: 20e9 }],
      balance: [{ code: 'SNTS', periode: '2025', total_actifs: 2500e9, tresorerie_equivalents: 300e9, dette_court_terme: 100e9, dette_long_terme: 250e9, total_capitaux_propres: 1100e9 }],
      cashFlow: [{ code: 'SNTS', periode: '2025', flux_tresorerie_disponible: 390e9 }],
      indicateursBancaires: [],
      dividendes: [{ code: 'SNTS', exercice: 2025, ex_date: dates[210]!, montant: 240, montant_brut: null, base_fiscale: 'net' }],
      liquidite: { code: 'SNTS', date_marche: dates.at(-1)!, score: 92, classe: 'A', presence_pct: 100, valeur_moyenne_30j: 150e6, amihud: 0.01, spread_pct: 0.1, flux_net_pct: 5 },
      events: [],
    },
    {
      instrument: { code: 'SGBC', designation: 'SOCIETE GENERALE CI', secteur: 'Services financiers', pays: "Côte d'Ivoire", famille_comptable: 'banque', actif: true, shares: 31_111_110, isin: 'CI0000000030', date_introduction: '1998-09-16' },
      cours: ajusterSerieActions('SGBC', mkSerie((i) => (i < 200 ? 18000 + i * 25 : 23000 - (i - 200) * 110), 4000), []).serieAjustee,
      ajustements: [],
      anomaliesCours: [],
      income: [{ code: 'SGBC', periode: '2025', revenu_total: 260e9, resultat_exploitation: null, resultat_net: 102e9, lignes_specifiques: { pnb: 260e9, coefficient_exploitation: 46 } }],
      balance: [{ code: 'SGBC', periode: '2025', total_actifs: 3400e9, tresorerie_equivalents: null, dette_court_terme: null, dette_long_terme: null, total_capitaux_propres: 440e9, lignes_specifiques: { ratio_solvabilite: 14.5, taux_creances_souffrance: 6.1 } }],
      cashFlow: [],
      indicateursBancaires: [],
      dividendes: [{ code: 'SGBC', exercice: 2025, ex_date: null, montant: 1500, montant_brut: null, base_fiscale: 'net' }],
      liquidite: { code: 'SGBC', date_marche: dates.at(-1)!, score: 78, classe: 'B', presence_pct: 98, valeur_moyenne_30j: 45e6, amihud: 0.08, spread_pct: 0.4, flux_net_pct: -8 },
      events: [],
    },
    {
      instrument: { code: 'SICC', designation: 'SICOR CI', secteur: 'Consommation de base', pays: "Côte d'Ivoire", famille_comptable: 'general', actif: true, shares: 600_000, isin: 'CI0000000055', date_introduction: '1998-09-16' },
      cours: ajusterSerieActions('SICC', mkSerie(() => 3000, 15).filter((_, i) => i % 5 === 0), []).serieAjustee,
      ajustements: [],
      anomaliesCours: [],
      income: [],
      balance: [],
      cashFlow: [],
      indicateursBancaires: [],
      dividendes: [],
      liquidite: { code: 'SICC', date_marche: dates.at(-1)!, score: 12, classe: 'D', presence_pct: 20, valeur_moyenne_30j: 200_000, amihud: 5.2, spread_pct: 6.5, flux_net_pct: 0 },
      events: [],
    },
  ];

  return { inputs, indice };
}

export async function runResilienceScanner(
  opts: { mock?: boolean; dryRun?: boolean } = {},
): Promise<ResilienceRunResult> {
  const mock = Boolean(opts.mock);
  const dryRun = opts.dryRun ?? (!mock && getConfig().DRY_RUN);

  if (mock) {
    const { inputs, indice } = fixtureMock();
    const res = calculerResilienceUnivers(inputs, indice);
    const secs = agregerSecteursStress(res);
    logger.info(
      {
        nb_valeurs: res.length,
        secteurs: secs.length,
        decrochages: res.filter((r) => r.decrochage_anormal).length,
      },
      '[mock] Stock Resilience Scanner exécuté',
    );
    return {
      status: 'mock',
      date_marche: res[0]?.date_marche ?? null,
      nb_valeurs: res.length,
      nb_decrochages: res.filter((r) => r.decrochage_anormal).length,
      nb_ecrites: 0,
    };
  }

  const sb: SupabaseClient = getSupabase();
  const debutFenetreCours = new Date(Date.now() - 800 * 86_400_000).toISOString().slice(0, 10);

  const [
    instruments,
    profils,
    opsTitres,
    coursRaw,
    indicesOff,
    indicesHist,
    incRaw,
    balRaw,
    cfRaw,
    indBancRaw,
    divsRaw,
    liqDateRow,
    eventsRaw,
  ] = await Promise.all([
    lirePage<{
      code: string;
      designation: string;
      secteur: string | null;
      pays: string | null;
      famille_comptable: string | null;
      actif: boolean;
      shares: number | null;
    }>(
      (from, to) =>
        sb
          .from('brvm_instruments')
          .select('code, designation, secteur, pays, famille_comptable, actif, shares')
          .eq('type', 'action')
          .range(from, to),
      'brvm_instruments',
    ),
    lirePage<{ code: string; identite: { isin?: string; introduction?: string; fractionnements?: Array<{ date?: string; parite?: string }> } | null }>(
      (from, to) => sb.from('societes_profils').select('code, identite').range(from, to),
      'societes_profils',
    ),
    lirePage<{ code: string; date_effet: string; ratio: number }>(
      (from, to) => sb.from('operations_titres').select('code, date_effet, ratio').range(from, to),
      'operations_titres',
    ),
    lirePage<{
      code: string;
      date_marche: string;
      cours_jour: number | null;
      variation_pct: number | null;
      volume: number | null;
      valeur_echangee: number | null;
    }>(
      (from, to) =>
        sb
          .from('brvm_actions_daily')
          .select('code, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
          .gte('date_marche', debutFenetreCours)
          .order('date_marche', { ascending: true })
          .order('code', { ascending: true })
          .range(from, to),
      'brvm_actions_daily',
    ),
    lirePage<{ code: string; date_marche: string; valeur: number; variation_pct: number | null }>(
      (from, to) =>
        sb
          .from('brvm_indices_daily')
          .select('code, date_marche, valeur, variation_pct')
          .eq('code', 'BRVMC')
          .order('date_marche', { ascending: true })
          .range(from, to),
      'brvm_indices_daily',
    ),
    lirePage<{ code: string; date_marche: string; valeur: number; variation_pct: number | null }>(
      (from, to) =>
        sb
          .from('stress_indices_history')
          .select('code, date_marche, valeur, variation_pct')
          .eq('code', 'BRVMC')
          .order('date_marche', { ascending: true })
          .range(from, to),
      'stress_indices_history',
    ).catch(() => []),
    lirePage<IncomeInput>(
      (from, to) =>
        sb
          .from('income_statements')
          .select('code, periode, revenu_total, resultat_exploitation, resultat_net, charges_financieres_nettes, lignes_specifiques')
          .range(from, to),
      'income_statements',
    ),
    lirePage<BalanceInput>(
      (from, to) =>
        sb
          .from('balance_sheets')
          .select('code, periode, total_actifs, tresorerie_equivalents, dette_court_terme, dette_long_terme, total_capitaux_propres, lignes_specifiques')
          .range(from, to),
      'balance_sheets',
    ),
    lirePage<CashFlowInput>(
      (from, to) =>
        sb.from('cash_flow_statements').select('code, periode, flux_tresorerie_disponible').range(from, to),
      'cash_flow_statements',
    ),
    lirePage<IndicateurBancaireInput>(
      (from, to) =>
        sb.from('indicateur_source').select('code, indicateur, date_arrete, valeur, statut').eq('statut', 'publie').range(from, to),
      'indicateur_source',
    ),
    lirePage<DividendInput>(
      (from, to) =>
        sb.from('dividends').select('code, exercice, ex_date, montant, montant_brut, base_fiscale').range(from, to),
      'dividends',
    ),
    sb.from('liquidity_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
    lirePage<EventInput>(
      (from, to) =>
        sb
          .from('market_events')
          .select('event_date, instrument_code, event_type, title')
          .gte('event_date', shiftIso(-180))
          .order('event_date', { ascending: false })
          .range(from, to),
      'market_events',
    ),
  ]);

  const lastLiqDate = (liqDateRow.data?.[0]?.date_marche as string | undefined) ?? null;
  const liqRows = lastLiqDate
    ? await lirePage<LiquidityInput>(
        (from, to) =>
          sb
            .from('liquidity_daily')
            .select('code, date_marche, score, classe, presence_pct, valeur_moyenne_30j, amihud, spread_pct, flux_net_pct')
            .eq('date_marche', lastLiqDate)
            .range(from, to),
        'liquidity_daily',
      )
    : [];

  // Fusionner BRVMC (stress_indices_history + brvm_indices_daily prioritaire)
  const brvmcMap = new Map<string, PointIndice>();
  for (const r of indicesHist) brvmcMap.set(String(r.date_marche).slice(0, 10), { date_marche: String(r.date_marche).slice(0, 10), valeur: Number(r.valeur), variation_pct: r.variation_pct });
  for (const r of indicesOff) brvmcMap.set(String(r.date_marche).slice(0, 10), { date_marche: String(r.date_marche).slice(0, 10), valeur: Number(r.valeur), variation_pct: r.variation_pct });
  const brvmcSerie = [...brvmcMap.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  const profilMap = new Map(profils.map((p) => [p.code, p.identite]));
  const liqMap = new Map(liqRows.map((l) => [l.code, l]));

  const groupByCode = <T extends { code: string }>(arr: readonly T[]) => {
    const m = new Map<string, T[]>();
    for (const x of arr) {
      const list = m.get(x.code) ?? [];
      list.push(x);
      m.set(x.code, list);
    }
    return m;
  };

  const coursByCode = groupByCode(coursRaw);
  const incByCode = groupByCode(incRaw);
  const balByCode = groupByCode(balRaw);
  const cfByCode = groupByCode(cfRaw);
  const indByCode = groupByCode(indBancRaw);
  const divByCode = groupByCode(divsRaw);
  const opsByCode = groupByCode(opsTitres);

  const inputs: ResilienceInputAction[] = [];
  for (const inst of instruments) {
    if (!inst.actif) continue;
    const idMeta = profilMap.get(inst.code);

    // Collecter les splits connus (operations_titres + societes_profils.identite.fractionnements)
    const splitMap = new Map<string, SplitConnu>();
    for (const f of idMeta?.fractionnements ?? []) {
      const ratio = parserPariteFractionnement(f.parite);
      if (f.date && ratio && ratio > 1) splitMap.set(f.date, { date_effet: f.date, ratio, source: 'societes_profils' });
    }
    for (const o of opsByCode.get(inst.code) ?? []) {
      splitMap.set(o.date_effet.slice(0, 10), { date_effet: o.date_effet.slice(0, 10), ratio: Number(o.ratio), source: 'operations_titres' });
    }

    const adj = ajusterSerieActions(inst.code, coursByCode.get(inst.code) ?? [], [...splitMap.values()]);
    const famille: FamilleComptable =
      inst.famille_comptable === 'banque' || inst.famille_comptable === 'assurance' ? inst.famille_comptable : 'general';

    inputs.push({
      instrument: {
        code: inst.code,
        designation: inst.designation,
        secteur: inst.secteur ?? 'Autre',
        pays: inst.pays,
        famille_comptable: famille,
        actif: inst.actif,
        shares: inst.shares != null ? Number(inst.shares) : null,
        isin: idMeta?.isin ?? null,
        date_introduction: idMeta?.introduction ?? null,
      },
      cours: adj.serieAjustee,
      ajustements: adj.ajustementsAppliques,
      anomaliesCours: adj.anomalies,
      income: incByCode.get(inst.code) ?? [],
      balance: balByCode.get(inst.code) ?? [],
      cashFlow: cfByCode.get(inst.code) ?? [],
      indicateursBancaires: indByCode.get(inst.code) ?? [],
      dividendes: divByCode.get(inst.code) ?? [],
      liquidite: liqMap.get(inst.code) ?? null,
      events: eventsRaw.filter((e) => e.instrument_code === inst.code),
    });
  }

  const rows = calculerResilienceUnivers(inputs, brvmcSerie);
  if (rows.length === 0) {
    return { status: 'failed', date_marche: null, nb_valeurs: 0, nb_decrochages: 0, nb_ecrites: 0, raison: 'Aucune valeur active calculable' };
  }

  const dateMarche = rows[0]!.date_marche;
  const nbDecrochages = rows.filter((r) => r.decrochage_anormal).length;

  if (dryRun) {
    logger.info({ date_marche: dateMarche, nb_valeurs: rows.length, nb_decrochages: nbDecrochages }, '[DRY_RUN] upsert stress_resilience_daily sauté');
    return { status: 'success', date_marche: dateMarche, nb_valeurs: rows.length, nb_decrochages: nbDecrochages, nb_ecrites: 0 };
  }

  const now = new Date().toISOString();
  let ecrits = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      ...r,
      methode_version: '1.0',
      updated_at: now,
    }));
    const { error } = await sb
      .from('stress_resilience_daily')
      .upsert(batch, { onConflict: 'code,date_marche' });
    if (error) throw new Error(`upsert stress_resilience_daily : ${error.message}`);
    ecrits += batch.length;
  }

  return { status: 'success', date_marche: dateMarche, nb_valeurs: rows.length, nb_decrochages: nbDecrochages, nb_ecrites: ecrits };
}

function shiftIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
