/**
 * Met à jour brvm_instruments.shares. Cascade : sikafinance (capi/cours).
 * Ne JAMAIS écraser une valeur shares_source='manual'.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { fetchSharesFromSikafinance } from './sikafinance.js';

export interface SharesRunResult { status: 'success' | 'failed'; nb: number; message: string | null; }

export async function runShares(): Promise<SharesRunResult> {
  const cfg = getConfig();
  try {
    const rows = await fetchSharesFromSikafinance();
    if (cfg.DRY_RUN) { logger.warn({ count: rows.length }, 'DRY_RUN — shares non écrits'); return { status: 'success', nb: rows.length, message: null }; }
    const sb = getSupabase();

    const { data: manual } = await sb
      .from('brvm_instruments')
      .select('code')
      .eq('shares_source', 'manual');
    const manualSet = new Set((manual ?? []).map((m) => m.code as string));

    let nb = 0;
    for (const r of rows) {
      if (manualSet.has(r.code)) continue;
      const { error } = await sb
        .from('brvm_instruments')
        .update({ shares: r.shares, shares_source: r.source })
        .eq('code', r.code);
      if (error) { logger.warn({ code: r.code, err: error.message }, 'update shares échec'); continue; }
      nb += 1;
    }
    logger.info({ nb }, 'shares mis à jour');
    return { status: 'success', nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'runShares échoué');
    return { status: 'failed', nb: 0, message };
  }
}
