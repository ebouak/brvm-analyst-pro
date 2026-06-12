/**
 * Persistance des données marché vers Supabase.
 * Upsert idempotent par (code, date_marche) — relancer un scraping de la même
 * date ne crée pas de doublon (cf. §5.6 / §6.3).
 */
import { getSupabase } from './supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import type {
  MarketSnapshot,
  ScrapeRunRecord,
  ScrapeStatus,
} from '../types.js';

/** Upsert du référentiel instruments (table brvm_instruments). */
export async function upsertInstruments(snapshot: MarketSnapshot): Promise<void>;
export async function upsertInstruments(instruments: Array<{
  code: string;
  designation: string;
  pays: string;
  secteur: string;
  type: string;
  statut: string;
  isin?: string;
  scraped_at: string;
}>): Promise<number>;
export async function upsertInstruments(snapshotOrInstruments: any): Promise<void | number> {
  const sb = getSupabase();

  // Overload: array of instruments (from BDFIN scrapers)
  if (Array.isArray(snapshotOrInstruments)) {
    const instruments = snapshotOrInstruments;
    if (instruments.length === 0) return 0;
    const rows = instruments.map((i) => ({
      code: i.code,
      designation: i.designation,
      pays: i.pays,
      secteur: i.secteur,
      type: i.type,
      actif: true,
    }));
    const { error } = await sb
      .from('brvm_instruments')
      .upsert(rows, { onConflict: 'code' });
    if (error) throw new Error(`upsert brvm_instruments: ${error.message}`);
    return rows.length;
  }

  // Original overload: MarketSnapshot
  const snapshot = snapshotOrInstruments as MarketSnapshot;
  const rows = [
    ...snapshot.actions.map((a) => ({
      code: a.code,
      designation: a.designation,
      pays: a.pays,
      secteur: a.secteur,
      type: 'action' as const,
      actif: true,
    })),
    ...snapshot.obligations.map((o) => ({
      code: o.code,
      designation: o.designation,
      pays: null,
      secteur: null,
      type: 'obligation' as const,
      actif: true,
    })),
    ...snapshot.indices.map((i) => ({
      code: i.code,
      designation: i.libelle,
      pays: null,
      secteur: null,
      type: 'indice' as const,
      actif: true,
    })),
  ];
  if (rows.length === 0) return;
  const { error } = await sb
    .from('brvm_instruments')
    .upsert(rows, { onConflict: 'code' });
  if (error) throw new Error(`upsert brvm_instruments: ${error.message}`);
}

export async function upsertActions(snapshot: MarketSnapshot): Promise<number>;
export async function upsertActions(actions: Array<{
  code: string;
  designation: string;
  cours_jour: number;
  cours_precedent: number;
  variation_pct: number;
  volume: number;
  nb_transactions: number;
  valeur_echangee: number;
  date_marche: string;
}>): Promise<number>;
export async function upsertActions(snapshotOrActions: any): Promise<number> {
  const sb = getSupabase();

  // Overload: array of actions with date_marche (from BDFIN scrapers)
  if (Array.isArray(snapshotOrActions)) {
    const actions = snapshotOrActions;
    if (actions.length === 0) return 0;
    const { error } = await sb
      .from('brvm_actions_daily')
      .upsert(actions, { onConflict: 'code,date_marche' });
    if (error) throw new Error(`upsert brvm_actions_daily: ${error.message}`);
    return actions.length;
  }

  // Original overload: MarketSnapshot
  const snapshot = snapshotOrActions as MarketSnapshot;
  if (snapshot.actions.length === 0) return 0;
  const rows = snapshot.actions.map((a) => ({
    code: a.code,
    date_marche: snapshot.date_marche,
    designation: a.designation,
    pays: a.pays,
    secteur: a.secteur,
    cours_precedent: a.cours_precedent,
    cours_jour: a.cours_jour,
    variation_pct: a.variation_pct,
    volume: a.volume,
    nb_transactions: a.nb_transactions,
    valeur_echangee: a.valeur_echangee,
  }));
  const { error } = await sb
    .from('brvm_actions_daily')
    .upsert(rows, { onConflict: 'code,date_marche' });
  if (error) throw new Error(`upsert brvm_actions_daily: ${error.message}`);
  return rows.length;
}

export async function upsertObligations(snapshot: MarketSnapshot): Promise<number>;
export async function upsertObligations(obligations: Array<{
  code: string;
  designation: string;
  cours_jour: number;
  cours_precedent: number;
  variation_pct: number;
  volume: number;
  nb_transactions: number;
  valeur_echangee: number;
  date_marche: string;
}>): Promise<number>;
export async function upsertObligations(snapshotOrObligations: any): Promise<number> {
  const sb = getSupabase();

  // Overload: array of obligations with date_marche (from BDFIN scrapers)
  if (Array.isArray(snapshotOrObligations)) {
    const obligations = snapshotOrObligations;
    if (obligations.length === 0) return 0;
    const { error } = await sb
      .from('brvm_obligations_daily')
      .upsert(obligations, { onConflict: 'code,date_marche' });
    if (error) throw new Error(`upsert brvm_obligations_daily: ${error.message}`);
    return obligations.length;
  }

  // Original overload: MarketSnapshot
  const snapshot = snapshotOrObligations as MarketSnapshot;
  if (snapshot.obligations.length === 0) return 0;
  const rows = snapshot.obligations.map((o) => ({
    code: o.code,
    date_marche: snapshot.date_marche,
    designation: o.designation,
    emetteur: o.emetteur,
    taux_pct: o.taux_pct,
    maturite: o.maturite,
    cours_precedent: o.cours_precedent,
    cours_jour: o.cours_jour,
    volume: o.volume,
    valeur_echangee: o.valeur_echangee,
  }));
  const { error } = await sb
    .from('brvm_obligations_daily')
    .upsert(rows, { onConflict: 'code,date_marche' });
  if (error) throw new Error(`upsert brvm_obligations_daily: ${error.message}`);
  return rows.length;
}

export async function upsertIndices(snapshot: MarketSnapshot): Promise<number> {
  const sb = getSupabase();
  if (snapshot.indices.length === 0) return 0;
  const rows = snapshot.indices.map((i) => ({
    code: i.code,
    date_marche: snapshot.date_marche,
    libelle: i.libelle,
    valeur: i.valeur,
    valeur_precedente: i.valeur_precedente,
    variation_pct: i.variation_pct,
  }));
  const { error } = await sb
    .from('brvm_indices_daily')
    .upsert(rows, { onConflict: 'code,date_marche' });
  if (error) throw new Error(`upsert brvm_indices_daily: ${error.message}`);
  return rows.length;
}

/** Totaux de séance (« Activités du marché ») -> brvm_market_summary. */
export async function upsertMarketSummary(snapshot: MarketSnapshot): Promise<number> {
  if (!snapshot.summary) return 0;
  const sb = getSupabase();
  const { error } = await sb
    .from('brvm_market_summary')
    .upsert(
      {
        date_marche: snapshot.date_marche,
        valeur_transactions: snapshot.summary.valeur_transactions,
        capitalisation_actions: snapshot.summary.capitalisation_actions,
        capitalisation_obligations: snapshot.summary.capitalisation_obligations,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date_marche' },
    );
  if (error) throw new Error(`upsert brvm_market_summary: ${error.message}`);
  return 1;
}

/** Persiste l'ensemble d'un snapshot (référentiel + 3 tables marché). */
export async function persistSnapshot(snapshot: MarketSnapshot): Promise<{
  nb_actions: number;
  nb_obligations: number;
  nb_indices: number;
}> {
  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.warn('DRY_RUN actif — aucune écriture en base');
    return {
      nb_actions: snapshot.actions.length,
      nb_obligations: snapshot.obligations.length,
      nb_indices: snapshot.indices.length,
    };
  }
  await upsertInstruments(snapshot);
  const nb_actions = await upsertActions(snapshot);
  const nb_obligations = await upsertObligations(snapshot);
  const nb_indices = await upsertIndices(snapshot);
  return { nb_actions, nb_obligations, nb_indices };
}

/** Détecte si un hash source a déjà été enregistré (anti-doublon de séance). */
export async function hashAlreadySeen(
  hash: string,
  dateMarche: string,
): Promise<boolean> {
  const cfg = getConfig();
  if (cfg.DRY_RUN) return false;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('scrape_runs')
    .select('id')
    .eq('hash_source', hash)
    .eq('date_marche', dateMarche)
    .eq('status', 'success')
    .limit(1);
  if (error) {
    logger.warn({ err: error.message }, 'Vérif hash impossible — on continue');
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Journalise un run dans scrape_runs (cf. §6.2). */
export async function logScrapeRun(record: ScrapeRunRecord): Promise<void> {
  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.info({ record }, 'DRY_RUN — scrape_runs non écrit');
    return;
  }
  const sb = getSupabase();
  const { error } = await sb.from('scrape_runs').insert(record);
  if (error) {
    // Ne jamais faire échouer le run principal à cause du log.
    logger.error({ err: error.message }, 'Échec écriture scrape_runs');
  }
}

export type { ScrapeStatus };

import type { NewsItem } from '../scrapers/brvmNews.js';

export async function upsertNews(items: NewsItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const sb = getSupabase();
  const { error } = await sb
    .from('brvm_news')
    .upsert(items, { onConflict: 'dedupe_hash', ignoreDuplicates: true });
  if (error) throw new Error(`upsert brvm_news: ${error.message}`);
  return items.length;
}
