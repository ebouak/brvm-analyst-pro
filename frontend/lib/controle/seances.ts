/**
 * Tour de contrôle — calendrier des séances BRVM (PUR, testé).
 *
 * La BRVM cote du lundi au vendredi. Les jours fériés ne sont connus qu'en
 * partie (`market_calendar` n'en déclare qu'une dizaine par an) : ils peuvent
 * être passés en paramètre, mais un férié inconnu reste possible. C'est
 * pourquoi l'appelant traite un retard d'UNE séance comme une simple
 * « attention » — ce peut être un férié que la base ignore.
 *
 * Toutes les dates sont en UTC (Abidjan = UTC, sans heure d'été).
 */

const JOUR_MS = 86_400_000;

/** 'AAAA-MM-JJ' → millisecondes à minuit UTC. N'accepte que le préfixe date. */
function versJour(iso: string): number {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

function versIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function estOuvre(ms: number, feries: ReadonlySet<string>): boolean {
  const jour = new Date(ms).getUTCDay(); // 0 dimanche, 6 samedi
  return jour !== 0 && jour !== 6 && !feries.has(versIso(ms));
}

/**
 * Date ISO du dernier jour ouvré (lun-ven, hors fériés connus) dont la donnée
 * DOIT être disponible à `maintenant`, sachant qu'elle l'est chaque jour ouvré
 * à partir de `heureDisponibiliteUtc` (fractions acceptées : 16.5 = 16:30).
 */
export function derniereSeanceAttendue(
  maintenant: Date,
  heureDisponibiliteUtc: number,
  feries: readonly string[] = [],
): string {
  const fer = new Set(feries);
  const minutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
  let jour = versJour(maintenant.toISOString());
  // Aujourd'hui ne compte que si l'heure de disponibilité est passée.
  if (!(estOuvre(jour, fer) && minutes >= Math.round(heureDisponibiliteUtc * 60))) {
    jour -= JOUR_MS;
    while (!estOuvre(jour, fer)) jour -= JOUR_MS;
  }
  return versIso(jour);
}

/**
 * Nombre de séances (jours ouvrés, week-ends et fériés connus exclus)
 * strictement postérieures à `derniere` et jusqu'à `attendue` incluse.
 * 0 si la donnée est à jour (ou en avance) ; +Infinity si aucune donnée.
 * `derniere` peut être un horodatage complet : seule la date compte.
 */
export function seancesDeRetard(derniere: string | null, attendue: string, feries: readonly string[] = []): number {
  if (!derniere) return Number.POSITIVE_INFINITY;
  const fer = new Set(feries);
  const fin = versJour(attendue);
  let n = 0;
  for (let j = versJour(derniere) + JOUR_MS; j <= fin; j += JOUR_MS) {
    if (estOuvre(j, fer)) n++;
  }
  return n;
}
