import { estJourOuvre } from '../utils/jourOuvre.js';

/** Heure UTC à partir de laquelle un passage `daily` vaut contrôle de clôture (cron 16:00 UTC). */
export const HEURE_CLOTURE_UTC = 15;

/**
 * Une séance absente n'est CRITIQUE (appel vocal) qu'au passage de clôture
 * d'un jour de séance. PUR. Le passage de 09:15 UTC (avant ouverture) et les
 * week-ends / jours fériés de `market_calendar` n'appellent personne.
 */
export function doitAlerterSeanceAbsente(maintenant: Date, feries: ReadonlySet<string>): boolean {
  if (maintenant.getUTCHours() < HEURE_CLOTURE_UTC) return false;
  return estJourOuvre(maintenant.toISOString().slice(0, 10), feries);
}
