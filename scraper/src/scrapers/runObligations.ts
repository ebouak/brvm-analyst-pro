/**
 * Runner obligations depuis le portail public brvm.org.
 * Écrit dans brvm_obligations_daily (code, date_marche) — idempotent.
 * Remplace sikafinance (page obligations supprimée → 404, juin 2026) et BDFIN
 * (auth non calibrée).
 */
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { ensureObligationInstruments, upsertObligations } from '../persistence/repository.js';
import { fetchBrvmObligations } from './brvmObligations.js';
import type { MarketSnapshot, ObligationRow } from '../types.js';

const log = logger.child({ module: 'runObligations' });

export interface ObligationsRunResult {
  status: 'success' | 'failed' | 'mock';
  nb: number;
  message: string | null;
}

const MOCK_ROWS = [
  { code: 'TPCI-6.8-2023', designation: 'TRESOR PUBLIC CI 6,8% 2023', emetteur: 'Trésor CI', taux_pct: 6.8, maturite: '2033-06-20', cours_precedent: 9950, cours_jour: 10050, volume: 200, valeur_echangee: 2010000 },
  { code: 'TPSN-6.5-2022', designation: 'TRESOR PUBLIC SN 6,5% 2022', emetteur: 'Trésor SN', taux_pct: 6.5, maturite: '2032-04-15', cours_precedent: 9900, cours_jour: 9920, volume: 150, valeur_echangee: 1488000 },
  { code: 'BICIC-5.9-2025', designation: 'BICICI 5,9% 2025', emetteur: 'BICICI', taux_pct: 5.9, maturite: '2030-11-10', cours_precedent: 10100, cours_jour: 10080, volume: 80, valeur_echangee: 806400 },
];

export async function runObligations(opts: { mock?: boolean } = {}): Promise<ObligationsRunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (useMock) {
      const rows = MOCK_ROWS.map((r) => ({ ...r, date_marche: today }));
      log.info({ nb: rows.length }, 'Obligations mock');
      return { status: 'mock', nb: rows.length, message: null };
    }

    const fetched: ObligationRow[] = await fetchBrvmObligations();
    if (fetched.length === 0) {
      log.warn('Aucune obligation parsée depuis brvm.org');
      return { status: 'failed', nb: 0, message: 'Aucune obligation parsée' };
    }

    if (cfg.DRY_RUN) {
      log.warn({ nb: fetched.length }, 'DRY_RUN — obligations non écrites');
      return { status: 'success', nb: fetched.length, message: null };
    }

    // On passe par un MarketSnapshot : l'overload mappe emetteur/taux_pct/maturité.
    const snapshot: MarketSnapshot = {
      date_marche: today,
      actions: [],
      obligations: fetched,
      indices: [],
      summary: null,
      hash_source: '',
      is_mock: false,
    };
    // Crée d'abord les instruments d'obligations manquants (FK code → brvm_instruments).
    await ensureObligationInstruments(fetched.map((o) => ({ code: o.code, designation: o.designation })));
    const nb = await upsertObligations(snapshot);
    log.info({ nb, date: today }, 'Obligations brvm.org écrites');
    return { status: 'success', nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'runObligations échoué');
    return { status: 'failed', nb: 0, message };
  }
}
