/**
 * Ancienneté d'un message en JOURS OUVRÉS : seul le temps écoulé du lundi au
 * vendredi compte (UTC, le fuseau d'Abidjan). L'accusé promet une réponse
 * « sous 2 jours ouvrés » ; on alerte dès qu'UN jour ouvré est passé, pour
 * garder une journée de marge sur l'engagement public.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

export const SEUIL_RETARD_JOURS = 1;

function ouvre(jourUtc: number): boolean {
  return jourUtc !== 0 && jourUtc !== 6;
}

/** Temps ouvré écoulé entre deux instants, en jours (fraction comprise). */
export function joursOuvresEcoules(depuis: Date, maintenant: Date): number {
  let t = depuis.getTime();
  const fin = maintenant.getTime();
  if (!(fin > t)) return 0;
  let ms = 0;
  while (t < fin) {
    const d = new Date(t);
    const minuitSuivant = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    const bout = Math.min(minuitSuivant, fin);
    if (ouvre(d.getUTCDay())) ms += bout - t;
    t = bout;
  }
  return ms / JOUR_MS;
}

export function enRetard(depuis: Date, maintenant: Date, seuil = SEUIL_RETARD_JOURS): boolean {
  return joursOuvresEcoules(depuis, maintenant) > seuil;
}
