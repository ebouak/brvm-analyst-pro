// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).
/**
 * Niveaux techniques dérivés des CLÔTURES RÉELLES — fonction PURE, testée.
 * `detect()` (lib/indicators) ne renvoie que des booléens : les bornes du canal
 * 20 séances y sont locales. On les recalcule ici plutôt que de modifier le
 * module partagé. Aucun niveau n'est saisi à la main (règle §5 : rien d'inventé).
 *
 * Deux règles d'analyste (passage 2026-11-15) :
 *  - SORTIE DE CANAL : une clôture à 5 FCFA au-dessus du plafond (0,01 %) n'est
 *    pas un franchissement. On exige un écart d'au moins `margePct` du niveau et
 *    d'au moins un pas de cotation. En deçà, le cours est « au contact ».
 *  - PAS DE COTATION : un niveau calculé (amplitude, invalidation) est arrondi
 *    au pas de cotation ; « 37 382,5 FCFA » n'est pas un prix qui peut s'afficher
 *    sur la cote.
 * Sans options, le comportement historique est conservé à l'identique (le
 * dossier valeur `lib/dossier/build.ts` appelle `computeLevels(closes)`).
 */

export interface Levels {
  /** Plus haut des 20 séances précédant la dernière. */
  resistance: number;
  /** Plus bas des 20 séances précédant la dernière. */
  support: number;
  /** Dernière clôture. */
  dernier: number;
  /** Sortie du canal par le haut, marge comprise. */
  cassureHaut: boolean;
  /** Sortie du canal par le bas, marge comprise. */
  cassureBas: boolean;
  /** Extensions HAUSSIÈRES au-delà de la résistance (amplitude projetée). Repères
   *  de calcul sans valeur de prévision : le narratif hebdo ne les écrit plus. */
  objectif1: number;
  objectif2: number;
  /** Extensions BAISSIÈRES sous le support. Ne jamais présenter d'objectif
   *  haussier à une valeur qui vient de rompre son support (et inversement). */
  objectifBas1: number;
  objectifBas2: number;
  /** Sous le support : niveau qui invaliderait la lecture haussière. */
  invalidation: number;
  /** Clôture à moins de la marge du plafond, sans franchissement net. */
  contactHaut?: boolean;
  /** Clôture à moins de la marge du plancher, sans rupture nette. */
  contactBas?: boolean;
  /** Écart de la clôture au plafond, en % du plafond (positif = au-dessus). */
  ecartPlafondPct?: number;
  /** Écart de la clôture au plancher, en % du plancher (négatif = en dessous). */
  ecartPlancherPct?: number;
  /** Pas de cotation retenu pour arrondir (absent = arrondi au centime, historique). */
  pas?: number;
  /** Marge de sortie de canal retenue, en %. */
  margePct?: number;
}

const FENETRE = 20;

/**
 * Pas de cotation des actions à la BRVM : 5 FCFA (Instruction BRVM I-E relative
 * au pas de cotation et aux quotités de négociation, point 1.1 ; constaté en
 * base : toutes les clôtures 2026 en sont des multiples, sauf ETIT).
 */
export const PAS_COTATION_BRVM = 5;

/**
 * Marge de sortie de canal : 1 %. C'est, en 2026, la variation absolue médiane
 * d'une séance sur la cote (1,01 % sur 10 140 séances échangées) et l'ordre de
 * grandeur de la fourchette médiane du carnet (0,83 % depuis octobre). Un écart
 * plus faible tient dans le bruit d'une seule séance ordinaire.
 */
export const MARGE_SORTIE_PCT = 1;

/**
 * Pas à retenir pour une série : 5 FCFA si toutes les clôtures en sont des
 * multiples ; sinon 1 FCFA (ETIT cote par unité sous 100 FCFA, et une série
 * ajustée d'un fractionnement porte des cours non conformes) — on arrondit alors
 * à l'unité plutôt que d'imposer un pas que la série elle-même dément.
 */
export function pasDeCotation(closes: number[]): number {
  const utiles = closes.filter((c) => Number.isFinite(c) && c > 0);
  if (utiles.length === 0) return 1;
  return utiles.every((c) => Math.abs(c / PAS_COTATION_BRVM - Math.round(c / PAS_COTATION_BRVM)) < 1e-9)
    ? PAS_COTATION_BRVM
    : 1;
}

/** Arrondi au pas le plus proche (jamais sous un pas : un cours est positif). */
export function arrondiPas(x: number, pas: number): number {
  if (!(pas > 0)) return x;
  return Math.max(pas, Math.round(x / pas) * pas);
}

export interface LevelsOptions {
  /** Pas de cotation : les niveaux calculés y sont arrondis. */
  pas?: number;
  /** Marge de sortie de canal, en % (0 = comparaison stricte, historique). */
  margePct?: number;
}

export function computeLevels(closes: number[], opts: LevelsOptions = {}): Levels | null {
  const n = closes.length;
  if (n < FENETRE + 2) return null;
  const canal = closes.slice(n - (FENETRE + 1), n - 1);
  const resistance = Math.max(...canal);
  const support = Math.min(...canal);
  const dernier = closes[n - 1]!;
  const amplitude = Math.max(resistance - support, 0);
  const pas = opts.pas;
  const marge = opts.margePct ?? 0;
  const round = pas ? (x: number) => arrondiPas(x, pas) : (x: number) => Math.round(x * 100) / 100;
  const r2 = (x: number) => Math.round(x * 100) / 100;

  // Seuil de franchissement : au moins la marge en %, et au moins un pas.
  const seuilHaut = Math.max((resistance * marge) / 100, pas ?? 0);
  const seuilBas = Math.max((support * marge) / 100, pas ?? 0);
  const strict = !pas && marge <= 0;
  const cassureHaut = strict ? dernier > resistance : dernier > resistance && dernier - resistance >= seuilHaut;
  const cassureBas = strict ? dernier < support : dernier < support && support - dernier >= seuilBas;

  const levels: Levels = {
    resistance: r2(resistance),
    support: r2(support),
    dernier: r2(dernier),
    cassureHaut,
    cassureBas,
    objectif1: round(resistance + amplitude * 0.5),
    objectif2: round(resistance + amplitude),
    objectifBas1: round(support - amplitude * 0.5),
    objectifBas2: round(support - amplitude),
    invalidation: round(support - amplitude * 0.25),
  };
  if (pas || marge > 0) {
    levels.contactHaut = !cassureHaut && Math.abs(dernier - resistance) <= seuilHaut;
    levels.contactBas = !cassureBas && Math.abs(dernier - support) <= seuilBas;
    levels.ecartPlafondPct = resistance > 0 ? r2(((dernier - resistance) / resistance) * 100) : 0;
    levels.ecartPlancherPct = support > 0 ? r2(((dernier - support) / support) * 100) : 0;
    if (pas) levels.pas = pas;
    levels.margePct = marge;
  }
  return levels;
}
