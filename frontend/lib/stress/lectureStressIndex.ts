import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculerSerieStressIndex } from './stressIndex';
import type {
  ActionSeanceStressInput,
  NervositeStressInput,
  StressDailyRow,
} from './stressIndexTypes';
import type { PointIndice } from './types';

const PAGE = 1000;

export interface DonneesStressIndexOverview {
  source_mode: 'table_precalculee' | 'calcul_live';
  actuel: StressDailyRow | null;
  historique: StressDailyRow[];
}

/**
 * Lit l'historique récent de `stress_daily_index` (clé publique) ou, si la
 * migration `0279` / le job `stress:daily` n'a pas encore tourné, calcule à la
 * volée les 140 dernières séances depuis les tables publiques existantes.
 */
export async function chargerStressIndexOverview(
  sb: SupabaseClient,
  maxSeances = 180,
): Promise<DonneesStressIndexOverview> {
  const { data: precalc, error } = await sb
    .from('stress_daily_index')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(maxSeances);

  if (!error && precalc && precalc.length > 0) {
    const historique = ([...precalc] as StressDailyRow[])
      .map((r) => ({
        ...r,
        date_marche: String(r.date_marche).slice(0, 10),
        stress_index: Number(r.stress_index),
        couverture_composantes_pct: Number(r.couverture_composantes_pct),
        nb_composantes_actives: Number(r.nb_composantes_actives),
        variation_5j_pts: r.variation_5j_pts != null ? Number(r.variation_5j_pts) : null,
        variation_20j_pts: r.variation_20j_pts != null ? Number(r.variation_20j_pts) : null,
        variation_60j_pts: r.variation_60j_pts != null ? Number(r.variation_60j_pts) : null,
      }))
      .reverse();
    return {
      source_mode: 'table_precalculee',
      actuel: historique.at(-1) ?? null,
      historique,
    };
  }

  // Repli gracieux en direct avant application de 0279
  const depuis = new Date(Date.now() - 420 * 86_400_000).toISOString().slice(0, 10);

  const lire = async <T>(
    build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ): Promise<T[]> => {
    const out: T[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error: err } = await build(offset, offset + PAGE - 1);
      if (err) return out;
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  };

  const [histIdx, offIdx, nervRows, instRows, actRows] = await Promise.all([
    lire<{ date_marche: string; valeur: number; variation_pct: number | null }>((from, to) =>
      sb
        .from('stress_indices_history')
        .select('date_marche, valeur, variation_pct')
        .eq('code', 'BRVMC')
        .order('date_marche', { ascending: true })
        .range(from, to),
    ),
    lire<{ date_marche: string; valeur: number; variation_pct: number | null }>((from, to) =>
      sb
        .from('brvm_indices_daily')
        .select('date_marche, valeur, variation_pct')
        .eq('code', 'BRVMC')
        .order('date_marche', { ascending: true })
        .range(from, to),
    ),
    lire<NervositeStressInput>((from, to) =>
      sb
        .from('brvm_nervosite_daily')
        .select('date_marche, valeur, rang')
        .gte('date_marche', depuis)
        .order('date_marche', { ascending: true })
        .range(from, to),
    ),
    lire<{ code: string; secteur: string | null; shares: number | null }>((from, to) =>
      sb.from('brvm_instruments').select('code, secteur, shares').eq('type', 'action').range(from, to),
    ),
    lire<{ code: string; date_marche: string; cours_jour: number | null; variation_pct: number | null; volume: number | null }>((from, to) =>
      sb
        .from('brvm_actions_daily')
        .select('code, date_marche, cours_jour, variation_pct, volume')
        .gte('date_marche', depuis)
        .order('date_marche', { ascending: true })
        .order('code', { ascending: true })
        .range(from, to),
    ),
  ]);

  const idxMap = new Map<string, PointIndice>();
  for (const r of histIdx) {
    if (Number(r.valeur) > 0) {
      const d = String(r.date_marche).slice(0, 10);
      idxMap.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    }
  }
  for (const r of offIdx) {
    if (Number(r.valeur) > 0) {
      const d = String(r.date_marche).slice(0, 10);
      idxMap.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    }
  }
  const serieComposite = [...idxMap.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  const instMap = new Map(instRows.map((i) => [i.code, i]));
  const actionsInput: ActionSeanceStressInput[] = [];
  for (const a of actRows) {
    if (a.cours_jour == null || !(Number(a.cours_jour) > 0)) continue;
    const m = instMap.get(a.code);
    const c = Number(a.cours_jour);
    actionsInput.push({
      date_marche: String(a.date_marche).slice(0, 10),
      code: a.code,
      secteur: m?.secteur ?? 'Autre',
      capitalisation: m?.shares != null && Number(m.shares) > 0 ? Math.round(c * Number(m.shares)) : null,
      cours_jour: c,
      variation_pct: a.variation_pct != null ? Number(a.variation_pct) : null,
      volume: a.volume != null ? Number(a.volume) : null,
    });
  }

  const historique = calculerSerieStressIndex(serieComposite, actionsInput, nervRows, { maxSeances });
  return {
    source_mode: 'calcul_live',
    actuel: historique.at(-1) ?? null,
    historique,
  };
}
