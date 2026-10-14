/**
 * Durée THÉORIQUE INDICATIVE pour écouler une position (spec §4.3).
 *
 * Supposer qu'on absorbe 100 % des échanges quotidiens serait irréaliste sur
 * un marché étroit : on suppose que les ventes représentent une part
 * PARTICIPATION_VOLUME des échanges moyens. Ce n'est PAS une garantie
 * d'exécution, et l'interface doit le dire.
 */
export const PARTICIPATION_VOLUME = 0.2;
export const SEUIL_ALERTE_SEANCES = 20;

export interface DureeEcoulement {
  /** Séances nécessaires, arrondies au-dessus ; null si non mesurable. */
  seances: number | null;
  /** Vrai au-delà de SEUIL_ALERTE_SEANCES. */
  alerte: boolean;
}

const NON_MESUREE: DureeEcoulement = { seances: null, alerte: false };

export function dureeTheorique(
  valeurPosition: number | null,
  valeurMoyenne30j: number | null,
  participation: number = PARTICIPATION_VOLUME,
): DureeEcoulement {
  if (
    valeurPosition == null || !Number.isFinite(valeurPosition) || valeurPosition <= 0 ||
    valeurMoyenne30j == null || !Number.isFinite(valeurMoyenne30j) || valeurMoyenne30j <= 0 ||
    !Number.isFinite(participation) || participation <= 0 || participation > 1
  ) {
    return { ...NON_MESUREE };
  }
  const ratio = valeurPosition / (valeurMoyenne30j * participation);
  if (!Number.isFinite(ratio)) {
    return { ...NON_MESUREE };
  }
  // Marge contre l'arrondi flottant : 20,000000000000004 ne doit pas devenir 21
  const seances = Math.max(1, Math.ceil(ratio - 1e-9));
  return { seances, alerte: seances > SEUIL_ALERTE_SEANCES };
}
