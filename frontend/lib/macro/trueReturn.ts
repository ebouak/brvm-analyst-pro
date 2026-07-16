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
  /**
   * Montant NET par action, en FCFA. Les émetteurs de la BRVM publient des
   * dividendes NETS de retenue à la source (IRVM), prélevée par l'ÉMETTEUR selon
   * son pays de cotation — pas selon le pays de l'investisseur. On réinvestit donc
   * ce net tel quel : le re-taxer serait une double imposition.
   */
  montantNet: number;
  /** Cours de réinvestissement : clôture au détachement (année exercice + 1). */
  coursReinvest: number;
}

export interface TrueReturnInput {
  /** Cours à l'entrée (début de fenêtre). */
  coursDebut: number;
  /** Cours à la sortie (fin de fenêtre). */
  coursFin: number;
  /** Dividendes NETS encaissés PENDANT la fenêtre (exercices N−1 des années détenues). */
  dividendes: DividendeExercice[];
  /** Inflation annuelle (%) de chaque année de la fenêtre — propre au pays. */
  inflations: number[];
}

export interface TrueReturnResult {
  /** Performance du COURS SEUL, en % — ce que tout le monde affiche. */
  prixSeulPct: number;
  /** Performance cours + dividendes nets réinvestis, en %. */
  totalNominalPct: number;
  /** Apport des dividendes, en points de pourcentage. */
  apportDividendesPts: number;
  /** Inflation cumulée sur la fenêtre, en %. */
  inflationCumulPct: number;
  /** LE chiffre : rendement total réinvesti, corrigé de l'inflation, en %. */
  vraiPct: number;
  /** Le placement a détruit du pouvoir d'achat malgré les dividendes. */
  perteReelle: boolean;
  /** Nombre d'actions détenues à la sortie (départ : 1). */
  actionsFinales: number;
}

/**
 * Calcule le rendement vrai. Renvoie `null` si une donnée indispensable manque —
 * jamais un chiffre approximatif présenté comme exact.
 *
 * ── L'impôt n'est PAS appliqué ici, et c'est voulu ──
 * Le dividende fourni est déjà NET : l'IRVM a été prélevé à la SOURCE par
 * l'émetteur. Le réinvestir tel quel est correct ; lui réappliquer un taux serait
 * une double imposition. La différence entre deux investisseurs de pays distincts
 * vient donc UNIQUEMENT de leur INFLATION respective — le dividende net, lui, est
 * le même pour tous.
 */
export function computeTrueReturn(input: TrueReturnInput): TrueReturnResult | null {
  const { coursDebut, coursFin, dividendes, inflations } = input;

  if (!(coursDebut > 0) || !(coursFin > 0)) return null;
  if (inflations.length === 0) return null;

  // On part d'UNE action. Chaque dividende NET rachète des actions au cours du
  // jour, et ces actions rapportent à leur tour l'année suivante.
  let actions = 1;

  // L'ordre compte : un dividende ne peut racheter que sur les actions détenues
  // À CET INSTANT. Trier garantit la chronologie même si l'appelant ne l'a pas fait.
  const chrono = [...dividendes].sort((a, b) => a.exercice - b.exercice);

  for (const d of chrono) {
    if (!(d.coursReinvest > 0) || !(d.montantNet >= 0)) return null; // donnée manquante
    actions += (actions * d.montantNet) / d.coursReinvest;
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
    inflationCumulPct,
    vraiPct: reel.realPct,
    perteReelle: reel.realPct < 0,
    actionsFinales: Math.round(actions * 10000) / 10000,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
