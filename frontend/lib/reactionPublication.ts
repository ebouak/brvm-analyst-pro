// Contrat commun : « la réaction du cours d'une action à une publication ».
// UNE seule façon de la calculer, pour qu'aucune page n'affiche deux chiffres
// différents pour le même fait. Fonctions pures, sans I/O ; s'appuie sur eventStudy.

import { eventStudy, type DatedClose } from './eventStudy';

/** Phrase de réserve obligatoire à afficher avec toute réaction. */
export const RESERVE_REACTION = 'Mesuré autour de la date de publication, non attribué à la publication.';

export interface ReactionPublication {
  /** Écart titre − indice (BRVM Composite) en %, sur l'horizon. NUL si non mesurable, jamais 0 par défaut. */
  ecartIndicePct: number | null;
  /** Vrai tant que la fenêtre de `horizon` séances n'est pas close (ou que la publication est postérieure à la dernière séance). */
  enCours: boolean;
  seancesObservees: number;
}

export function reactionPublication(
  serieTitre: DatedClose[],
  serieIndice: DatedClose[],
  datePublication: string,
  horizon = 5,
): ReactionPublication {
  const r = eventStudy(serieTitre, serieTitre.map(() => null), serieIndice, datePublication, horizon);
  return {
    ecartIndicePct: r.found ? r.abnormalReturnPost : null,
    enCours: !r.found || !r.fenetreComplete,
    seancesObservees: r.seancesObservees,
  };
}

export interface ReactionsPublications {
  lignes: { date: string; ecartIndicePct: number | null; enCours: boolean }[];
  /** Médiane des seules réactions mesurées ET closes ; null s'il y en a moins de 3. */
  mediane: number | null;
  nMesurees: number;
}

export function reactionsPublications(
  serieTitre: DatedClose[],
  serieIndice: DatedClose[],
  dates: string[],
  horizon = 5,
): ReactionsPublications {
  const lignes = dates.map((date) => {
    const r = reactionPublication(serieTitre, serieIndice, date, horizon);
    return { date, ecartIndicePct: r.ecartIndicePct, enCours: r.enCours };
  });
  const valeurs = lignes
    .filter((l) => !l.enCours && l.ecartIndicePct != null)
    .map((l) => l.ecartIndicePct as number)
    .sort((a, b) => a - b);
  const n = valeurs.length;
  let mediane: number | null = null;
  if (n >= 3) {
    mediane = n % 2 === 1 ? valeurs[(n - 1) / 2]! : (valeurs[n / 2 - 1]! + valeurs[n / 2]!) / 2;
  }
  return { lignes, mediane, nMesurees: n };
}
