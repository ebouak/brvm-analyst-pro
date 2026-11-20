/**
 * Décision de déclenchement de la consolidation de clôture (`bdfin.yml`).
 *
 * RÉFÉRENCE TESTÉE de la fonction SQL `public.dispatch_cloture_si_necessaire()`
 * (migration 0252), appelée par pg_cron à 15:20, 15:50, 16:30 et 17:30 UTC.
 * Le SQL ne se teste pas ici ; cette fonction en fixe la règle, et la
 * migration la reproduit branche pour branche. Toute correction des deux côtés.
 */
export const FENETRE_RUN_EN_COURS_MIN = 30;

export type Decision =
  | { dispatcher: false; raison: 'week-end' | 'jour-ferme' | 'deja-confirmee' | 'run-en-cours' | 'jeton-absent' }
  | { dispatcher: true; raison: 'dispatch' };

export interface EtatDispatch {
  /** Jour ISO de la semaine, 1 = lundi … 7 = dimanche (comme `isodow` en SQL). */
  isodow: number;
  /** market_calendar.is_trading_day = false pour ce jour. */
  jourFerme: boolean;
  /** cloture_confirmee(jour) — voir confirmation.ts. */
  confirmee: boolean;
  /** Un run `daily` en statut `running` démarré il y a moins de 30 min. */
  runEnCours: boolean;
  /** Secret Vault `github_pat_brvm` lisible. */
  jetonPresent: boolean;
}

/** PURE. L'ordre des tests est celui de la fonction SQL. */
export function decisionDispatch(e: EtatDispatch): Decision {
  if (e.isodow > 5) return { dispatcher: false, raison: 'week-end' };
  if (e.jourFerme) return { dispatcher: false, raison: 'jour-ferme' };
  if (e.confirmee) return { dispatcher: false, raison: 'deja-confirmee' };
  if (e.runEnCours) return { dispatcher: false, raison: 'run-en-cours' };
  if (!e.jetonPresent) return { dispatcher: false, raison: 'jeton-absent' };
  return { dispatcher: true, raison: 'dispatch' };
}
