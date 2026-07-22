/**
 * Niveaux techniques dérivés des CLÔTURES RÉELLES — fonction PURE, testée.
 * `detect()` (lib/indicators) ne renvoie que des booléens : les bornes du canal
 * 20 séances y sont locales. On les recalcule ici plutôt que de modifier le
 * module partagé. Aucun niveau n'est saisi à la main (règle §5 : rien d'inventé).
 */

export interface Levels {
  /** Plus haut des 20 séances précédant la dernière. */
  resistance: number;
  /** Plus bas des 20 séances précédant la dernière. */
  support: number;
  /** Dernière clôture. */
  dernier: number;
  cassureHaut: boolean;
  cassureBas: boolean;
  /** Extensions HAUSSIÈRES au-delà de la résistance (amplitude projetée). */
  objectif1: number;
  objectif2: number;
  /** Extensions BAISSIÈRES sous le support. Ne jamais présenter d'objectif
   *  haussier à une valeur qui vient de rompre son support (et inversement). */
  objectifBas1: number;
  objectifBas2: number;
  /** Sous le support : niveau qui invaliderait la lecture haussière. */
  invalidation: number;
}

const FENETRE = 20;

export function computeLevels(closes: number[]): Levels | null {
  const n = closes.length;
  if (n < FENETRE + 2) return null;
  const canal = closes.slice(n - (FENETRE + 1), n - 1);
  const resistance = Math.max(...canal);
  const support = Math.min(...canal);
  const dernier = closes[n - 1]!;
  const amplitude = Math.max(resistance - support, 0);
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    resistance: round(resistance),
    support: round(support),
    dernier: round(dernier),
    cassureHaut: dernier > resistance,
    cassureBas: dernier < support,
    objectif1: round(resistance + amplitude * 0.5),
    objectif2: round(resistance + amplitude),
    objectifBas1: round(support - amplitude * 0.5),
    objectifBas2: round(support - amplitude),
    invalidation: round(support - amplitude * 0.25),
  };
}
