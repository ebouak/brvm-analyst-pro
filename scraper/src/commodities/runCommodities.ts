/**
 * Runner d'ingestion des prix matières premières (World Bank Pink Sheet) vers
 * la table commodity_prices (idempotent sur commodity,date).
 */
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { fetchPinkSheet, type CommodityPriceRow } from './worldBankPinkSheet.js';

const log = logger.child({ module: 'runCommodities' });

export interface CommoditiesRunResult {
  status: 'success' | 'failed' | 'mock';
  nb: number;
  message: string | null;
}

const MOCK_ROWS: CommodityPriceRow[] = [
  { commodity: 'cocoa', date: '2025-12-01', price: 5.78, unit: '$/kg' },
  { commodity: 'palm_oil', date: '2025-12-01', price: 980.51, unit: '$/mt' },
  { commodity: 'sugar', date: '2025-12-01', price: 0.32, unit: '$/kg' },
  { commodity: 'rubber', date: '2025-12-01', price: 1.74, unit: '$/kg' },
];

export async function runCommodities(opts: { mock?: boolean } = {}): Promise<CommoditiesRunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;

  try {
    const rows = useMock ? MOCK_ROWS : await fetchPinkSheet();
    if (rows.length === 0) {
      return { status: 'failed', nb: 0, message: 'Aucune donnée matières premières parsée' };
    }

    if (useMock) {
      log.info({ nb: rows.length }, 'Commodities mock');
      return { status: 'mock', nb: rows.length, message: null };
    }
    if (cfg.DRY_RUN) {
      log.warn({ nb: rows.length }, 'DRY_RUN — commodities non écrites');
      return { status: 'success', nb: rows.length, message: null };
    }

    const sb = getSupabase();
    // Upsert par lots (idempotent sur la clé naturelle).
    let written = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK).map((r) => ({
        commodity: r.commodity, date: r.date, price: r.price, unit: r.unit, source: 'worldbank_pinksheet',
      }));
      const { error } = await sb.from('commodity_prices').upsert(batch, { onConflict: 'commodity,date' });
      if (error) throw new Error(`upsert commodity_prices: ${error.message}`);
      written += batch.length;
    }

    log.info({ nb: written }, 'Commodities écrites');
    return { status: 'success', nb: written, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'runCommodities échoué');
    return { status: 'failed', nb: 0, message };
  }
}
