import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { scrapeDetails } from './richbourse-details.js';

const THROTTLE_MS = 800;
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export interface DetailsResult {
  status: 'success' | 'failed' | 'mock';
  count: number;
  message?: string;
}

export async function runDetails(opts: { codes?: string[]; mock?: boolean } = {}): Promise<DetailsResult> {
  if (opts.mock) {
    logger.info('Details mock — pas de scraping richbourse');
    return { status: 'mock', count: 0, message: 'mode mock, aucun upsert' };
  }

  const sb = getSupabase();

  let codes = opts.codes ?? [];
  if (codes.length === 0) {
    const { data } = await sb.from('brvm_instruments').select('code').eq('type', 'action');
    codes = (data ?? []).map((r: { code: string }) => r.code);
  }

  logger.info({ total: codes.length }, 'Scraping détails richbourse');
  let successCount = 0;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    const detail = await scrapeDetails(code);
    if (!detail) { if (i < codes.length - 1) await sleep(THROTTLE_MS); continue; }

    if (detail.ouverture != null || detail.plus_haut != null || detail.plus_bas != null) {
      const { error: e1 } = await sb
        .from('brvm_actions_daily')
        .update({ ouverture: detail.ouverture, plus_haut: detail.plus_haut, plus_bas: detail.plus_bas })
        .eq('code', code)
        .eq('date_marche', detail.date_marche);
      if (e1) logger.warn({ code, err: e1.message }, 'Update brvm_actions_daily échoué');
    }

    if (detail.flottant != null || detail.vol_moyen != null) {
      const patch: Record<string, number> = {};
      if (detail.flottant != null) patch.flottant = detail.flottant;
      if (detail.vol_moyen != null) patch.vol_moyen_30j = detail.vol_moyen;
      const { error: e2 } = await sb.from('brvm_instruments').update(patch).eq('code', code);
      if (e2) logger.warn({ code, err: e2.message }, 'Update brvm_instruments échoué');
    }

    successCount++;
    if (i < codes.length - 1) await sleep(THROTTLE_MS);
  }

  logger.info({ count: successCount, total: codes.length }, 'Détails richbourse ingérés');
  return { status: 'success', count: successCount };
}
