/**
 * État du dernier relevé de la collecte intraday — PUR, testé.
 *
 * Pourquoi (2026-11-23) : la pastille « À jour · il y a 13 min » était calculée
 * au rendu et ne bougeait plus ; sur la fiche action elle contredisait, juste à
 * côté, « En direct · cours mis à jour à 12:15 ». Une seule phrase, dérivée de
 * l'heure du relevé (`brvm_actions_daily.updated_at`), sert désormais partout.
 *
 * - « prochain vers 12:30 » et jamais un compte à rebours à la seconde : la
 *   collecte part d'un cron dont l'heure varie de quelques minutes.
 * - Au-delà de RETARD_RELEVE_MIN, on dit « relevé en retard » plutôt que
 *   d'annoncer un prochain relevé déjà dépassé.
 * - « Aucun échange relevé depuis l'ouverture » vient des DONNÉES (tous les
 *   volumes du jour à zéro), pas de l'horloge : le 23/11, rien n'a été échangé
 *   avant le relevé de 10:15 alors que la séance était ouverte.
 */

/** Une collecte toutes les 15 minutes pendant la séance (intraday.yml). */
export const CADENCE_RELEVE_MIN = 15;
/** Au-delà, le relevé attendu n'est pas venu. */
export const RETARD_RELEVE_MIN = 25;
/** Aucun relevé de séance n'est annoncé après cette heure (UTC). */
export const FIN_RELEVES_UTC = 16;

const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

export interface EtatReleve {
  /** « 12:15 » (UTC). */
  heure: string;
  ageMin: number;
  /** « 12:30 », ou null si aucun relevé de séance n'est attendu après. */
  prochain: string | null;
  enRetard: boolean;
}

export function etatReleve(dernier: Date, maintenant: Date): EtatReleve {
  const ageMin = Math.max(0, Math.floor((maintenant.getTime() - dernier.getTime()) / 60_000));
  const suivant = new Date(dernier.getTime() + CADENCE_RELEVE_MIN * 60_000);
  const prochain = suivant.getUTCHours() < FIN_RELEVES_UTC ? hhmm(suivant) : null;
  return { heure: hhmm(dernier), ageMin, prochain, enRetard: prochain != null && ageMin > RETARD_RELEVE_MIN };
}

const depuis = (min: number) => (min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : `il y a ${Math.floor(min / 60)} h`);

/**
 * Phrase complète : « Relevé de 12:15 · il y a 4 min · prochain vers 12:30 ».
 * `echanges === false` (tous les volumes du jour à zéro) : « Aucun échange
 * relevé depuis l'ouverture · relevé de 09:45 ». `null` : inconnu, on n'en dit rien.
 */
export function phraseReleve(p: { dernier: Date; maintenant: Date; echanges?: boolean | null }): string {
  const e = etatReleve(p.dernier, p.maintenant);
  if (p.echanges === false) return `Aucun échange relevé depuis l'ouverture · relevé de ${e.heure}`;
  const suite = e.enRetard ? 'relevé en retard' : e.prochain ? `prochain vers ${e.prochain}` : null;
  return [`Relevé de ${e.heure}`, depuis(e.ageMin), suite].filter(Boolean).join(' · ');
}

/** Version courte, à côté du point « En direct » : sans l'âge, déjà dit par la pastille. */
export function phraseReleveCourte(p: { dernier: Date; maintenant: Date; echanges?: boolean | null }): string {
  const e = etatReleve(p.dernier, p.maintenant);
  if (p.echanges === false) return `aucun échange depuis l'ouverture · relevé de ${e.heure}`;
  const suite = e.enRetard ? 'relevé en retard' : e.prochain ? `prochain vers ${e.prochain}` : null;
  return [`relevé de ${e.heure}`, suite].filter(Boolean).join(' · ');
}

/** Plus récente `updated_at` parmi des lignes reçues ; aucune → null. */
export function dernierReleveDe(lignes: readonly { updated_at?: string | null }[]): Date | null {
  let max: number | null = null;
  for (const l of lignes) {
    const t = l.updated_at ? Date.parse(l.updated_at) : NaN;
    if (Number.isFinite(t) && (max == null || t > max)) max = t;
  }
  return max == null ? null : new Date(max);
}

/**
 * Le marché a-t-il échangé aujourd'hui ? Seulement sur un ensemble assez large
 * pour parler du MARCHÉ (une valeur sans volume ne dit rien des autres) ;
 * sinon, ou si aucun volume n'est connu : null.
 */
export function echangesDuMarche(lignes: readonly { volume?: number | null }[], minimum = 20): boolean | null {
  const connus = lignes.filter((l) => l.volume != null);
  if (connus.length < minimum) return null;
  return connus.some((l) => (l.volume ?? 0) > 0);
}
