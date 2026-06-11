/**
 * Enrichit la séance du jour de brvm_actions_daily avec le détail de cotation
 * Sika Finance (ouverture, +haut, +bas, beta, valorisation, capital échangé).
 * Met à jour les lignes existantes (code, date_marche = aujourd'hui).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { fetchCotationDetails } from './sikaCotation.js';

const log = logger.child({ module: 'runCotations' });

export interface CotationsRunResult { status: 'success' | 'failed'; nb: number; message: string | null; }

export async function runCotations(opts: { codes?: string[] } = {}): Promise<CotationsRunResult> {
  const cfg = getConfig();
  try {
    const details = await fetchCotationDetails(opts.codes);
    if (cfg.DRY_RUN) {
      log.warn({ count: details.length }, 'DRY_RUN — détails non écrits');
      return { status: 'success', nb: details.length, message: null };
    }
    const sb = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    let nb = 0;
    for (const d of details) {
      const patch: Record<string, number> = {};
      if (d.ouverture != null) patch.ouverture = d.ouverture;
      if (d.plus_haut != null) patch.plus_haut = d.plus_haut;
      if (d.plus_bas != null) patch.plus_bas = d.plus_bas;
      if (d.beta_1an != null) patch.beta_1an = d.beta_1an;
      if (d.valorisation != null) patch.valorisation = d.valorisation;
      if (d.valeur_echangee != null) patch.valeur_echangee = d.valeur_echangee;
      if (Object.keys(patch).length === 0) continue;

      const { error } = await sb
        .from('brvm_actions_daily')
        .update(patch)
        .eq('code', d.code)
        .eq('date_marche', today);
      if (error) { log.warn({ code: d.code, err: error.message }, 'update détail échec'); continue; }
      nb += 1;
    }
    log.info({ nb, total: details.length }, 'Détails de cotation écrits');
    return { status: 'success', nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'runCotations échoué');
    return { status: 'failed', nb: 0, message };
  }
}
