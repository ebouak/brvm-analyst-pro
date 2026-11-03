/**
 * « Le marché aujourd'hui » (tableau de bord) : trois chiffres de la dernière
 * séance, chacun menant à sa page. PUR et testé.
 *
 * Aucune formule nouvelle : chaque chiffre est celui de la page de destination.
 * - Secteurs : `aggregateBySector` (lib/sectors), la fonction de /secteurs.
 *   Le secteur vient de la ligne, à défaut du référentiel `brvm_instruments`,
 *   exactement comme /secteurs l'enrichit.
 * - Largeur (hausses / baisses / stables) : `metriquesDepuisSeance`, déjà
 *   calculée par le tableau de bord (une variation inconnue n'est pas « stable »).
 * - Obligations : `syntheseObligations` (lib/marche/obligations).
 */
import { aggregateBySector } from '@/lib/sectors';

export interface LigneSecteur {
  code: string;
  secteur: string | null;
  date_marche: string;
  cours_jour: number | null;
  variation_pct: number | null;
  valeur_echangee: number | null;
}

export interface ExtremeSecteur {
  secteur: string;
  /** Variation moyenne du jour des valeurs du secteur, en %. */
  variation: number;
}

export interface ExtremesSecteurs {
  meilleur: ExtremeSecteur;
  pire: ExtremeSecteur;
  /** Secteurs ayant une variation connue à cette séance. */
  nbSecteurs: number;
}

/**
 * Meilleur et pire secteur de la séance `dateMarche`, au sens de /secteurs
 * (variation moyenne du jour). `null` si moins de deux secteurs ont une
 * variation connue : un classement d'un seul élément n'a pas de « pire ».
 */
export function extremesSecteurs(
  lignes: LigneSecteur[],
  secteurParCode: ReadonlyMap<string, string | null>,
  dateMarche: string,
): ExtremesSecteurs | null {
  const duJour = lignes
    .filter((l) => l.date_marche === dateMarche)
    .map((l) => ({ ...l, secteur: l.secteur ?? secteurParCode.get(l.code) ?? null }));
  const classes = aggregateBySector(duJour, dateMarche).filter(
    (p): p is typeof p & { varDay: number } => p.varDay != null && Number.isFinite(p.varDay),
  );
  if (classes.length < 2) return null;
  const premier = classes[0]!;
  const dernier = classes[classes.length - 1]!;
  return {
    meilleur: { secteur: premier.secteur, variation: premier.varDay },
    pire: { secteur: dernier.secteur, variation: dernier.varDay },
    nbSecteurs: classes.length,
  };
}

export interface LargeurSeance {
  hausses: number;
  baisses: number;
  stables: number;
}

/** Largeur du marché, ou `null` si la séance n'a aucune variation connue. */
export function largeurSeance(m: { hausses: number | null; baisses: number | null; stables: number | null }): LargeurSeance | null {
  if (m.hausses == null || m.baisses == null || m.stables == null) return null;
  if (m.hausses + m.baisses + m.stables === 0) return null;
  return { hausses: m.hausses, baisses: m.baisses, stables: m.stables };
}
