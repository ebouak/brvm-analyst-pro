/**
 * LE RENDEMENT VRAI — ce qu'une action BRVM a réellement rapporté.
 *
 *   cours  +  dividendes réinvestis  −  impôt IRVM du pays  −  inflation du pays
 *
 * ── Pourquoi ce calcul manquait, et pourquoi il change tout ──
 * Toutes les plateformes de la place (et la nôtre jusqu'ici) affichent la
 * performance du COURS SEUL. Sur la BRVM, où les rendements du dividende tournent
 * entre 5 et 8 %, c'est une omission massive : une valeur au cours stagnant mais
 * qui verse 7 % par an y apparaît médiocre. C'est faux — et ça pousse
 * l'investisseur à fuir précisément les meilleures valeurs de rendement.
 *
 * ── Le réinvestissement, pas la simple addition ──
 * On ne fait PAS « cours + somme des dividendes ». Chaque dividende net rachète
 * des actions au cours du jour de son détachement, et ces actions rapportent à
 * leur tour. C'est la capitalisation : sur trois ans elle change sensiblement le
 * résultat, et c'est ce que fait réellement un investisseur qui réinvestit.
 *
 * ── Ce qu'on refuse de faire ──
 * Un dividende ABSENT de la base n'est PAS un dividende nul. Traiter l'absence
 * comme un zéro sous-estimerait le rendement — exactement l'erreur qu'on corrige.
 * Les fonctions ci-dessous exigent donc des données complètes et renvoient `null`
 * sinon. L'écran affiche alors « données incomplètes », jamais un faux chiffre.
 *
 * Fonctions PURES, testées.
 */

import { realReturn, cumulativeInflation } from './realReturn';

export interface DividendeExercice {
  /** Exercice comptable. Le dividende est détaché l'année SUIVANTE. */
  exercice: number;
  /** Montant BRUT par action, en FCFA. */
  montantBrut: number;
  /** Cours de réinvestissement : clôture au détachement (année exercice + 1). */
  coursReinvest: number;
}

export interface TrueReturnInput {
  /** Cours à l'entrée (début de fenêtre). */
  coursDebut: number;
  /** Cours à la sortie (fin de fenêtre). */
  coursFin: number;
  /** Dividendes encaissés PENDANT la fenêtre (exercices N−1 des années détenues). */
  dividendes: DividendeExercice[];
  /**
   * Taux de retenue à la source (IRVM) du pays de l'investisseur, ex. 0.10.
   * `null` = taux non confirmé : on calcule alors SANS impôt et l'appelant doit
   * le signaler. On n'invente jamais un taux fiscal.
   */
  tauxIrvm: number | null;
  /** Inflation annuelle (%) de chaque année de la fenêtre. */
  inflations: number[];
}

export interface TrueReturnResult {
  /** Performance du COURS SEUL, en % — ce que tout le monde affiche. */
  prixSeulPct: number;
  /** Performance cours + dividendes NETS réinvestis, en %. */
  totalNominalPct: number;
  /** Apport des dividendes, en points de pourcentage. */
  apportDividendesPts: number;
  /** Impôt total prélevé sur les dividendes, en FCFA pour 1 action détenue. */
  impotFcfa: number;
  /** Inflation cumulée sur la fenêtre, en %. */
  inflationCumulPct: number;
  /** LE chiffre : rendement total, net d'impôt, corrigé de l'inflation, en %. */
  vraiPct: number;
  /** Le placement a détruit du pouvoir d'achat malgré les dividendes. */
  perteReelle: boolean;
  /** Nombre d'actions détenues à la sortie (départ : 1). */
  actionsFinales: number;
  /** Aucun taux d'impôt confirmé pour ce pays : `vraiPct` est un MAJORANT. */
  impotNonConfirme: boolean;
}

/**
 * Calcule le rendement vrai. Renvoie `null` si une donnée indispensable manque —
 * jamais un chiffre approximatif présenté comme exact.
 */
export function computeTrueReturn(input: TrueReturnInput): TrueReturnResult | null {
  const { coursDebut, coursFin, dividendes, tauxIrvm, inflations } = input;

  if (!(coursDebut > 0) || !(coursFin > 0)) return null;
  if (inflations.length === 0) return null;

  const taux = tauxIrvm ?? 0; // taux non confirmé → on ne prélève rien, et on le DIT
  const impotNonConfirme = tauxIrvm === null;

  // On part d'UNE action. Chaque dividende net rachète des actions au cours du
  // jour, et ces actions rapportent à leur tour l'année suivante.
  let actions = 1;
  let impotFcfa = 0;

  // L'ordre compte : un dividende ne peut racheter que sur les actions détenues
  // À CET INSTANT. Trier garantit la chronologie même si l'appelant ne l'a pas fait.
  const chrono = [...dividendes].sort((a, b) => a.exercice - b.exercice);

  for (const d of chrono) {
    if (!(d.coursReinvest > 0) || !(d.montantBrut >= 0)) return null; // donnée manquante

    const brut = actions * d.montantBrut;
    const impot = brut * taux;
    const net = brut - impot;

    impotFcfa += impot;
    actions += net / d.coursReinvest;
  }

  const valeurFinale = actions * coursFin;

  const prixSeulPct = ((coursFin - coursDebut) / coursDebut) * 100;
  const totalNominalPct = ((valeurFinale - coursDebut) / coursDebut) * 100;

  const inflationCumulPct = cumulativeInflation(inflations);
  if (inflationCumulPct === null) return null;

  const reel = realReturn({ nominalPct: totalNominalPct, inflationPct: inflationCumulPct });

  return {
    prixSeulPct: r2(prixSeulPct),
    totalNominalPct: r2(totalNominalPct),
    apportDividendesPts: r2(totalNominalPct - prixSeulPct),
    impotFcfa: Math.round(impotFcfa),
    inflationCumulPct,
    vraiPct: reel.realPct,
    perteReelle: reel.realPct < 0,
    actionsFinales: Math.round(actions * 10000) / 10000,
    impotNonConfirme,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
