export interface Pilier { poids: number; valeur: number | null }
export interface Decomposition { sommePonderee: number; penalite: number; score: number }

/** Somme pondérée des piliers disponibles (poids redistribués sur ceux-ci) ; pénalité = somme − score, jamais négative. */
export function decomposerScore(piliers: Pilier[], score: number | null): Decomposition | null {
  if (score == null) return null;
  const dispo = piliers.filter((p) => p.valeur != null);
  const poids = dispo.reduce((a, p) => a + p.poids, 0);
  if (dispo.length === 0 || poids <= 0) return null;
  const somme = dispo.reduce((a, p) => a + p.poids * (p.valeur as number), 0) / poids;
  return { sommePonderee: somme, penalite: Math.max(0, somme - score), score };
}

/** Le calcul du modèle est plus ancien que la dernière séance connue. Dates AAAA-MM-JJ. */
export function calculeEstAncien(dateCalcul: string | null, derniereSeance: string | null): boolean {
  return dateCalcul != null && derniereSeance != null && dateCalcul.slice(0, 10) < derniereSeance.slice(0, 10);
}
