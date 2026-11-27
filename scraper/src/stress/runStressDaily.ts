/**
 * Runner CLI Phase 4 — BRVM Market Stress Index quotidien (`npm run stress:daily`).
 * Lit les clôtures consolidées (`stress_indices_history` + `brvm_indices_daily`),
 * `brvm_actions_daily`, `brvm_instruments` et `brvm_nervosite_daily`, calcule
 * la série quotidienne 0-100 sans signal d'achat, et upsert dans `stress_daily_index`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { calculerSerieStressIndex } from './pure/stressIndex.js';
import type { ActionSeanceStressInput, NervositeStressInput } from './pure/stressIndexTypes.js';
import type { PointIndice } from './pure/types.js';

const PAGE = 1000;
const BATCH = 150;

export interface StressDailyRunResult {
  status: 'success' | 'mock' | 'failed';
  derniere_seance: string | null;
  dernier_indice: number | null;
  regime: string | null;
  lignes_calculees: number;
  lignes_ecrites: number;
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

export async function runStressDaily(
  opts: { mock?: boolean; dryRun?: boolean; maxSeances?: number } = {},
): Promise<StressDailyRunResult> {
  const mock = Boolean(opts.mock);
  const dryRun = opts.dryRun ?? (!mock && getConfig().DRY_RUN);
  const maxSeances = opts.maxSeances ?? 320;

  if (mock) {
    const dates: string[] = [];
    let t = Date.UTC(2026, 0, 2);
    while (dates.length < 120) {
      const d = new Date(t);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
      t += 86_400_000;
    }
    const indice: PointIndice[] = dates.map((d, i) => ({
      date_marche: d,
      valeur: i < 80 ? 450 + i * 1.2 : 546 - (i - 80) * 2.3,
    }));
    const serie = calculerSerieStressIndex(indice, [], [], { maxSeances: 120 });
    const dern = serie.at(-1) ?? null;
    logger.info(
      { seances: serie.length, dernier: dern?.stress_index, regime: dern?.regime },
      '[mock] BRVM Stress Index exécuté',
    );
    return {
      status: 'mock',
      derniere_seance: dern?.date_marche ?? null,
      dernier_indice: dern?.stress_index ?? null,
      regime: dern?.regime ?? null,
      lignes_calculees: serie.length,
      lignes_ecrites: 0,
    };
  }

  const sb: SupabaseClient = getSupabase();
  const depuisActions = new Date(Date.now() - 560 * 86_400_000).toISOString().slice(0, 10);

  const [indicesOff, indicesHist, nervRows, instRows, actionsRaw] = await Promise.all([
    lirePage<{ date_marche: string; valeur: number; variation_pct: number | null }>(
      (from, to) =>
        sb
          .from('brvm_indices_daily')
          .select('date_marche, valeur, variation_pct')
          .eq('code', 'BRVMC')
          .order('date_marche', { ascending: true })
          .range(from, to),
      'brvm_indices_daily',
    ),
    lirePage<{ date_marche: string; valeur: number; variation_pct: number | null }>(
      (from, to) =>
        sb
          .from('stress_indices_history')
          .select('date_marche, valeur, variation_pct')
          .eq('code', 'BRVMC')
          .order('date_marche', { ascending: true })
          .range(from, to),
      'stress_indices_history',
    ).catch(() => []),
    lirePage<NervositeStressInput>(
      (from, to) =>
        sb
          .from('brvm_nervosite_daily')
          .select('date_marche, valeur, rang')
          .gte('date_marche', depuisActions)
          .order('date_marche', { ascending: true })
          .range(from, to),
      'brvm_nervosite_daily',
    ),
    lirePage<{ code: string; secteur: string | null; shares: number | null }>(
      (from, to) =>
        sb.from('brvm_instruments').select('code, secteur, shares').eq('type', 'action').range(from, to),
      'brvm_instruments',
    ),
    lirePage<{ code: string; date_marche: string; cours_jour: number | null; variation_pct: number | null; volume: number | null }>(
      (from, to) =>
        sb
          .from('brvm_actions_daily')
          .select('code, date_marche, cours_jour, variation_pct, volume')
          .gte('date_marche', depuisActions)
          .order('date_marche', { ascending: true })
          .order('code', { ascending: true })
          .range(from, to),
      'brvm_actions_daily',
    ),
  ]);

  const brvmcMap = new Map<string, PointIndice>();
  for (const r of indicesHist) {
    if (Number(r.valeur) > 0) {
      const d = String(r.date_marche).slice(0, 10);
      brvmcMap.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    }
  }
  for (const r of indicesOff) {
    if (Number(r.valeur) > 0) {
      const d = String(r.date_marche).slice(0, 10);
      brvmcMap.set(d, { date_marche: d, valeur: Number(r.valeur), variation_pct: r.variation_pct });
    }
  }
  const serieComposite = [...brvmcMap.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));
  if (serieComposite.length === 0) {
    return {
      status: 'failed',
      derniere_seance: null,
      dernier_indice: null,
      regime: null,
      lignes_calculees: 0,
      lignes_ecrites: 0,
      raison: 'Aucune série BRVMC disponible',
    };
  }

  const instMap = new Map(instRows.map((i) => [i.code, i]));
  const actionsInput: ActionSeanceStressInput[] = [];
  for (const a of actionsRaw) {
    if (a.cours_jour == null || !(Number(a.cours_jour) > 0)) continue;
    const meta = instMap.get(a.code);
    const cours = Number(a.cours_jour);
    const cap = meta?.shares != null && Number(meta.shares) > 0 ? Math.round(cours * Number(meta.shares)) : null;
    actionsInput.push({
      date_marche: String(a.date_marche).slice(0, 10),
      code: a.code,
      secteur: meta?.secteur ?? 'Autre',
      capitalisation: cap,
      cours_jour: cours,
      variation_pct: a.variation_pct != null ? Number(a.variation_pct) : null,
      volume: a.volume != null ? Number(a.volume) : null,
    });
  }

  const rows = calculerSerieStressIndex(serieComposite, actionsInput, nervRows, { maxSeances });
  if (rows.length === 0) {
    return {
      status: 'failed',
      derniere_seance: null,
      dernier_indice: null,
      regime: null,
      lignes_calculees: 0,
      lignes_ecrites: 0,
      raison: 'Série résultante vide',
    };
  }

  let ecrits = 0;
  if (!dryRun) {
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({
        ...r,
        methode_version: '1.0',
        updated_at: now,
      }));
      const { error } = await sb.from('stress_daily_index').upsert(batch, { onConflict: 'date_marche' });
      if (error) throw new Error(`upsert stress_daily_index : ${error.message}`);
      ecrits += batch.length;
    }
  }

  const dern = rows.at(-1)!;
  return {
    status: 'success',
    derniere_seance: dern.date_marche,
    dernier_indice: dern.stress_index,
    regime: dern.regime,
    lignes_calculees: rows.length,
    lignes_ecrites: ecrits,
  };
}
