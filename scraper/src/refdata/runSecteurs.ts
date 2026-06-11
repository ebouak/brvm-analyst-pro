/**
 * Renseigne brvm_instruments.secteur selon la classification sectorielle
 * officielle ICB de la BRVM (7 secteurs), confirmée depuis le sélecteur
 * `dlSector` de Sika Finance (/marches/secteurs) :
 *   1000 Énergie · 2000 Industriels · 2500 Consommation discrétionnaire
 *   3000 Consommation de base · 4000 Services financiers
 *   5000 Télécommunications · 5500 Services publics
 *
 * Valeurs catégorielles publiques (référentiel), jamais des chiffres financiers.
 * Le groupe « Services financiers » est confirmé en direct (16 valeurs cotées).
 * Idempotent : UPDATE par code ; n'affecte que les codes présents en base.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runSecteurs' });

/** Code BRVM → secteur ICB BRVM (libellé FR). */
export const SECTEURS: Record<string, string> = {
  // Services financiers (confirmé en direct sur Sika Finance)
  BICB: 'Services financiers', BICC: 'Services financiers',
  BOAB: 'Services financiers', BOABF: 'Services financiers',
  BOAC: 'Services financiers', BOAM: 'Services financiers',
  BOAN: 'Services financiers', BOAS: 'Services financiers',
  CBIBF: 'Services financiers', ECOC: 'Services financiers',
  ETIT: 'Services financiers', NSBC: 'Services financiers',
  ORGT: 'Services financiers', SAFC: 'Services financiers',
  SGBC: 'Services financiers', SIBC: 'Services financiers',
  // Télécommunications
  ONTBF: 'Télécommunications', ORAC: 'Télécommunications', SNTS: 'Télécommunications',
  // Services publics
  CIEC: 'Services publics', SDCC: 'Services publics',
  // Énergie
  SHEC: 'Énergie', TTLC: 'Énergie',
  // Consommation de base (agro-alimentaire, boissons)
  PALC: 'Consommation de base', SCRC: 'Consommation de base',
  SICC: 'Consommation de base', NTLC: 'Consommation de base',
  SLBC: 'Consommation de base', SPHC: 'Consommation de base',
  SOGC: 'Consommation de base', UNLC: 'Consommation de base',
  // Consommation discrétionnaire (distribution, automobile, services)
  BNBC: 'Consommation discrétionnaire', CFAC: 'Consommation discrétionnaire',
  PRSC: 'Consommation discrétionnaire', NEIC: 'Consommation discrétionnaire',
  LNBB: 'Consommation discrétionnaire', ABJC: 'Consommation discrétionnaire',
  STBC: 'Consommation discrétionnaire',
  // Industriels
  CABC: 'Industriels', FTSC: 'Industriels', SEMC: 'Industriels',
  SIVC: 'Industriels', SDSC: 'Industriels', SMBC: 'Industriels',
  STAC: 'Industriels',
};

export interface SecteursRunResult { status: 'success' | 'failed'; nb: number; message: string | null; }

export async function runSecteurs(): Promise<SecteursRunResult> {
  const cfg = getConfig();
  try {
    const sb = getSupabase();
    const { data: instruments, error } = await sb
      .from('brvm_instruments')
      .select('code')
      .eq('type', 'action')
      .eq('actif', true);
    if (error) throw new Error(`load instruments: ${error.message}`);

    const present = new Set((instruments ?? []).map((i) => i.code as string));
    const updates = Object.entries(SECTEURS).filter(([code]) => present.has(code));
    const missing = [...present].filter((c) => !(c in SECTEURS));
    if (missing.length) log.warn({ missing }, 'Actions sans secteur mappé (à compléter)');

    if (cfg.DRY_RUN) {
      log.warn({ count: updates.length }, 'DRY_RUN — secteurs non écrits');
      return { status: 'success', nb: updates.length, message: null };
    }

    let nb = 0;
    for (const [code, secteur] of updates) {
      const { error: e } = await sb.from('brvm_instruments').update({ secteur }).eq('code', code);
      if (e) { log.warn({ code, err: e.message }, 'update secteur échec'); continue; }
      nb += 1;
    }
    log.info({ nb, total: updates.length }, 'Secteurs renseignés');
    return { status: 'success', nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'runSecteurs échoué');
    return { status: 'failed', nb: 0, message };
  }
}
