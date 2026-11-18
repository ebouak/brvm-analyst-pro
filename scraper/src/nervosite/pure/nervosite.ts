// COPIE de frontend/lib/nervosite/nervosite.ts — NE PAS MODIFIER ICI.
// Deux paquets TS distincts : toute correction se reporte des deux côtés.
// Garde-fou : scraper/tests/nervositeCopie.test.ts échoue si elles divergent.
/**
 * Indice de nervosité WESTBOURSE, calculé à partir du marché BRVM.
 *
 * La BRVM n'a pas de marché d'options : on ne peut pas calculer une volatilité
 * implicite comme le VIX. Cet indice mesure donc la volatilité RÉALISÉE,
 * exprimée comme le VIX en pourcentage annualisé.
 *
 *   V = 100 × √250 × √( ½·σ²rapide + ½·σ²lente )
 *
 *   σ²rapide : moyenne mobile exponentielle des rendements au carré (λ = 0,94)
 *   σ²lente  : moyenne des rendements au carré sur 250 séances
 *
 * Logique pure : aucune lecture de base, aucun accès réseau.
 * Ce n'est ni une prévision ni un conseil en investissement.
 */

export const LAMBDA = 0.94;
export const FENETRE_LENTE = 250;
export const FENETRE_INIT = 60;
export const SEANCES_PAR_AN = 250;
/** Au-delà de ±8,5 % en une séance, la variation dépasse la limite de cotation
 *  de la BRVM : c'est une opération sur titre ou une erreur, pas un mouvement de marché. */
export const SEUIL_ABERRANT = 0.085;

export type Regime = 'calme' | 'normal' | 'agité' | 'tendu';

export interface PointNervosite {
  /** Indice, en % annualisé. `null` tant que l'historique est insuffisant. */
  valeur: number | null;
  /** Composante rapide seule, en % annualisé. */
  rapide: number | null;
  /** Composante lente seule, en % annualisé. */
  lente: number | null;
}

/** Rendements logarithmiques d'une série de cours. Les variations aberrantes sont neutralisées (0). */
export function rendementsLog(cours: readonly number[], seuil = SEUIL_ABERRANT): number[] {
  const r: number[] = [];
  for (let i = 1; i < cours.length; i++) {
    const a = cours[i - 1]!, b = cours[i]!;
    if (!(a > 0) || !(b > 0)) { r.push(0); continue; }
    const x = Math.log(b / a);
    r.push(Math.abs(x) > seuil ? 0 : x);
  }
  return r;
}

/** Rendement du « marché large » : moyenne simple des rendements des titres cotés ce jour-là. */
export function rendementMarche(rendementsDuJour: readonly (number | null)[]): number {
  let s = 0, n = 0;
  for (const x of rendementsDuJour) if (x !== null && Number.isFinite(x)) { s += x; n++; }
  return n ? s / n : 0;
}

const annualise = (variance: number) => Math.sqrt(variance * SEANCES_PAR_AN) * 100;

/** Série complète de l'indice, alignée sur `rendements`. */
export function serieNervosite(rendements: readonly number[]): PointNervosite[] {
  const n = rendements.length;
  const out: PointNervosite[] = [];
  let rapide: number | null = null;
  let sommeInit = 0;
  let sommeLente = 0;
  for (let i = 0; i < n; i++) {
    const c = rendements[i]! * rendements[i]!;
    if (i < FENETRE_INIT) {
      sommeInit += c;
      if (i === FENETRE_INIT - 1) rapide = sommeInit / FENETRE_INIT;
    } else {
      rapide = LAMBDA * rapide! + (1 - LAMBDA) * c;
    }
    sommeLente += c;
    if (i >= FENETRE_LENTE) sommeLente -= rendements[i - FENETRE_LENTE]! * rendements[i - FENETRE_LENTE]!;
    const lente = i >= FENETRE_LENTE - 1 ? sommeLente / FENETRE_LENTE : null;
    out.push({
      valeur: rapide !== null && lente !== null ? annualise(0.5 * rapide + 0.5 * Math.max(lente, 0)) : null,
      rapide: rapide !== null ? annualise(rapide) : null,
      lente: lente !== null ? annualise(Math.max(lente, 0)) : null,
    });
  }
  return out;
}

/** Dernière valeur de l'indice. */
export function nervosite(rendements: readonly number[]): PointNervosite {
  const s = serieNervosite(rendements);
  return s[s.length - 1] ?? { valeur: null, rapide: null, lente: null };
}

/** Rang (0 à 100) d'une valeur dans son propre historique. */
export function rangHistorique(valeur: number, historique: readonly number[]): number {
  if (!historique.length) return NaN;
  let n = 0;
  for (const x of historique) if (x <= valeur) n++;
  return (100 * n) / historique.length;
}

/** Fenêtre du rang : les 1 250 dernières séances au plus (≈ 5 ans), la séance comprise. */
export const FENETRE_RANG = 1250;
/** Pas de rang sous 250 valeurs : classer une valeur parmi trois autres ne dirait rien. */
export const MIN_RANG = 250;

/**
 * Rang (0 à 100) de chaque valeur parmi les `fenetre` dernières valeurs connues
 * à sa date, elle-même comprise. Jamais de valeur future ; une valeur plus
 * ancienne que la fenêtre n'influe plus. Une entrée `null` n'a pas de rang et
 * n'entre pas dans l'historique. Sous `min` valeurs dans la fenêtre : `null`.
 */
export function rangsGlissants(
  valeurs: readonly (number | null)[],
  fenetre = FENETRE_RANG,
  min = MIN_RANG,
): (number | null)[] {
  const historique: number[] = [];
  return valeurs.map((v) => {
    if (v === null || !Number.isFinite(v)) return null;
    historique.push(v);
    if (historique.length > fenetre) historique.shift();
    return historique.length >= min ? rangHistorique(v, historique) : null;
  });
}

/** Régime, défini par le rang dans l'historique et non par un seuil fixe. */
export function regime(rang: number): Regime {
  if (rang < 25) return 'calme';
  if (rang < 75) return 'normal';
  if (rang < 90) return 'agité';
  return 'tendu';
}
