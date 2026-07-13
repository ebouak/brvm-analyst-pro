/**
 * Rendement RÉEL (corrigé de l'inflation).
 *
 * ── L'erreur que presque tout le monde commet ──
 * Soustraire : réel ≈ nominal − inflation. C'est une APPROXIMATION, fausse dès
 * que les taux montent. La formule exacte est celle de Fisher :
 *
 *     (1 + réel) = (1 + nominal) / (1 + inflation)
 *
 * Exemple : +10 % nominal, 9 % d'inflation (Niger 2024).
 *   Soustraction : 10 − 9 = +1,00 %  → « on gagne »
 *   Fisher       : 1,10/1,09 − 1 = +0,92 %
 * L'écart paraît petit ici, mais il se creuse avec les taux et se compose dans le
 * temps. On applique Fisher — sur un marché où l'inflation a atteint 9 %, la
 * simplification n'est pas un détail.
 *
 * Fonctions PURES, testées (convention du dépôt).
 */

export interface RealReturnInput {
  /** Rendement nominal en % (ex. 7.5 pour +7,5 %). */
  nominalPct: number;
  /** Inflation en % sur la même période (ex. 3.45). */
  inflationPct: number;
}

export interface RealReturnResult {
  realPct: number;
  /** L'inflation a mangé tout le gain : le pouvoir d'achat a baissé. */
  destroysValue: boolean;
  /** Écart avec l'approximation naïve (nominal − inflation), en points. */
  naiveErrorPts: number;
}

/** Formule de Fisher. Retourne le rendement réel en %. */
export function realReturn({ nominalPct, inflationPct }: RealReturnInput): RealReturnResult {
  const n = nominalPct / 100;
  const i = inflationPct / 100;

  // Garde-fou : une inflation de −100 % ferait une division par zéro. Cas
  // impossible dans la réalité, mais une donnée corrompue ne doit pas produire
  // un Infinity qui s'afficherait comme un rendement mirifique.
  if (i <= -1) return { realPct: NaN, destroysValue: false, naiveErrorPts: NaN };

  const real = ((1 + n) / (1 + i) - 1) * 100;
  const naive = nominalPct - inflationPct;

  return {
    realPct: round2(real),
    destroysValue: real < 0,
    naiveErrorPts: round2(naive - real),
  };
}

/**
 * Ce que 1 000 000 FCFA placés deviennent, en pouvoir d'achat d'aujourd'hui,
 * après `years` années à ce rendement réel.
 *
 * C'est la seule façon de rendre le concept tangible : « +2 % réel » ne parle à
 * personne ; « votre million vaut 1 104 000 FCFA d'aujourd'hui dans 5 ans », si.
 */
export function purchasingPower(capital: number, realPct: number, years: number): number {
  if (!Number.isFinite(realPct) || years < 0) return NaN;
  return Math.round(capital * Math.pow(1 + realPct / 100, years));
}

/**
 * Rendement réel annualisé sur plusieurs années d'inflation observée.
 *
 * On CHAÎNE les inflations réelles année par année plutôt que d'en prendre la
 * moyenne : une moyenne arithmétique de taux de croissance est mathématiquement
 * fausse (c'est la moyenne géométrique qui s'impose). Sur une série 9 % / 1 % /
 * 3 %, la différence est réelle.
 *
 * Retourne null si aucune donnée d'inflation — on n'invente pas.
 */
export function cumulativeInflation(rates: number[]): number | null {
  if (rates.length === 0) return null;
  const factor = rates.reduce((acc, r) => acc * (1 + r / 100), 1);
  return round2((factor - 1) * 100);
}

/** Inflation annualisée équivalente à une série (moyenne géométrique). */
export function annualizedInflation(rates: number[]): number | null {
  if (rates.length === 0) return null;
  const factor = rates.reduce((acc, r) => acc * (1 + r / 100), 1);
  return round2((Math.pow(factor, 1 / rates.length) - 1) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
