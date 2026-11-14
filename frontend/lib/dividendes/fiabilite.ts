/**
 * Fiabilité du dividende — fonctions PURES, testées.
 *
 * Trois lectures factuelles, aucune recommandation :
 *  - taux de distribution du dernier exercice (dividende × titres ÷ résultat) ;
 *  - croissance annuelle moyenne du dividende sur 5 exercices au plus ;
 *  - exercices sans versement dans la fenêtre.
 * Une distribution supérieure au résultat de l'exercice (> 100 %) est signalée :
 * elle se finance sur les réserves ou la trésorerie, ce qui ne se répète pas
 * indéfiniment (SDSC, ABJC, CFAC, BOAB à l'audit du 2026-11-13).
 */

export interface LigneDividende { exercice: number | null; montant: number }
export interface LigneResultat { year: number | null; net_income: number | null }

export const FENETRE_ANS = 5;

export interface FiabiliteDividende {
  dernierExercice: number;
  dernierMontant: number;
  /** Distribution du dernier exercice, de 0 à … (1 = 100 % du résultat) ; null si résultat inconnu ou ≤ 0. */
  distribution: number | null;
  distributionAuDela: boolean;
  /** Croissance annuelle moyenne, ex. 0.05 = +5 %/an ; null sans deux exercices versés. */
  croissanceAnnuelle: number | null;
  /** Nombre d'exercices de la fenêtre. */
  exercicesFenetre: number;
  /** Exercices de la fenêtre sans versement (absent ou nul). */
  sansVersement: number[];
}

export function fiabiliteDividende(
  dividendes: LigneDividende[],
  resultats: LigneResultat[],
  titres: number | null,
): FiabiliteDividende | null {
  // Un exercice = un montant (le plus élevé si doublon de saisie).
  const parExercice = new Map<number, number>();
  for (const d of dividendes) {
    if (d.exercice == null || !Number.isFinite(d.montant)) continue;
    parExercice.set(d.exercice, Math.max(parExercice.get(d.exercice) ?? 0, d.montant));
  }
  const verses = [...parExercice.entries()].filter(([, m]) => m > 0).sort((a, b) => b[0] - a[0]);
  if (!verses.length) return null;
  const [dernierExercice, dernierMontant] = verses[0]!;

  const debut = dernierExercice - FENETRE_ANS + 1;
  const fenetre = Array.from({ length: FENETRE_ANS }, (_, i) => debut + i);
  // On ne compte un trou qu'à partir du premier exercice connu : avant, la base ne sait pas.
  const premierConnu = Math.min(...parExercice.keys());
  const exercices = fenetre.filter((e) => e >= premierConnu);
  const sansVersement = exercices.filter((e) => !((parExercice.get(e) ?? 0) > 0));

  const versesFenetre = verses.filter(([e]) => e >= debut);
  const plusAncien = versesFenetre[versesFenetre.length - 1];
  const croissanceAnnuelle =
    plusAncien && plusAncien[0] < dernierExercice
      ? Math.pow(dernierMontant / plusAncien[1], 1 / (dernierExercice - plusAncien[0])) - 1
      : null;

  const rn = resultats.find((r) => r.year === dernierExercice)?.net_income ?? null;
  const distribution = rn != null && rn > 0 && titres != null && titres > 0 ? (dernierMontant * titres) / rn : null;

  return {
    dernierExercice,
    dernierMontant,
    distribution,
    distributionAuDela: distribution != null && distribution > 1,
    croissanceAnnuelle,
    exercicesFenetre: exercices.length,
    sansVersement,
  };
}
