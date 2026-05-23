/**
 * Ingestion des dividendes.
 *  - mode mock : jeu de dividendes fictifs ;
 *  - mode réel : dérive les dividendes des événements déjà ingérés
 *    (market_events de type 'dividende') en extrayant le montant du résumé/titre.
 *
 * Idempotent par dedupe_hash (code + exercice + montant).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { sha256 } from '../utils/hash.js';
import { extractDividendAmount, extractExercice } from './extract.js';
import type { Dividend } from './types.js';

function dedupe(d: Dividend): string {
  return sha256(`${d.code}|${d.exercice ?? ''}|${d.montant}`);
}

function buildMock(): Dividend[] {
  return [
    { code: 'SNTS', exercice: 2025, ex_date: '2026-05-20', payment_date: '2026-06-05', montant: 1750, devise: 'XOF', source: 'BRVM', source_url: null },
    { code: 'SGBC', exercice: 2025, ex_date: '2026-05-15', payment_date: '2026-06-01', montant: 900, devise: 'XOF', source: 'BRVM', source_url: null },
    { code: 'CIEC', exercice: 2025, ex_date: '2026-05-10', payment_date: '2026-05-28', montant: 250, devise: 'XOF', source: 'BRVM', source_url: null },
  ];
}

export interface DividendsRunResult {
  status: 'success' | 'failed' | 'mock';
  nb: number;
  message: string | null;
}

export async function runDividends(opts: { mock?: boolean } = {}): Promise<DividendsRunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;

  try {
    let divs: Dividend[];
    if (useMock) {
      logger.warn('Mode MOCK dividendes');
      divs = buildMock();
    } else {
      divs = await deriveFromEvents();
    }
    const nb = await upsert(divs);
    logger.info({ nb }, 'Dividendes ingérés');
    return { status: useMock ? 'mock' : 'success', nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Ingestion dividendes échouée');
    return { status: 'failed', nb: 0, message };
  }
}

async function deriveFromEvents(): Promise<Dividend[]> {
  const cfg = getConfig();
  if (cfg.DRY_RUN) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('market_events')
    .select('event_date, title, summary, instrument_code, source, source_url')
    .eq('event_type', 'dividende')
    .not('instrument_code', 'is', null);
  if (error) throw new Error(error.message);

  const out: Dividend[] = [];
  for (const e of data ?? []) {
    const text = `${e.title ?? ''} ${e.summary ?? ''}`;
    const montant = extractDividendAmount(text);
    if (montant == null) continue;
    const year = new Date((e.event_date as string) + 'T00:00:00Z').getUTCFullYear();
    out.push({
      code: e.instrument_code as string,
      exercice: extractExercice(text, year - 1),
      ex_date: e.event_date as string,
      payment_date: null,
      montant,
      devise: 'XOF',
      source: (e.source as string) ?? 'BRVM',
      source_url: (e.source_url as string) ?? null,
    });
  }
  return out;
}

async function upsert(divs: Dividend[]): Promise<number> {
  const cfg = getConfig();
  if (divs.length === 0) return 0;
  if (cfg.DRY_RUN) {
    logger.warn({ count: divs.length }, 'DRY_RUN — dividendes non écrits');
    return divs.length;
  }
  const sb = getSupabase();
  const rows = divs.map((d) => ({ ...d, dedupe_hash: dedupe(d) }));
  const { error } = await sb.from('dividends').upsert(rows, { onConflict: 'dedupe_hash' });
  if (error) throw new Error(`upsert dividends: ${error.message}`);
  return rows.length;
}
