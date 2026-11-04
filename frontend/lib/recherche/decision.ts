import type { FicheSociete, ResultatJevValide, ResultatRecherche, StatutRecherche } from './types';

export const SEUIL_PERTINENT = 0.5;
export const MAX_RESULTATS = 8;
export const MIN_CORRESPONDANCE = 3;

export function statutParNombre(n: number): StatutRecherche {
  if (n === 0) return 'aucune';
  return n < MIN_CORRESPONDANCE ? 'partielle' : 'correspondance';
}

const arrondi = (x: number) => Math.round(x * 100) / 100;

/** Pertinence globale < 0,5 ⇒ aucune société imposée ; sinon les scores ≥ 0,5, triés, 8 au plus. */
export function resultatsJev(v: ResultatJevValide, fiches: FicheSociete[]): { statut: StatutRecherche; resultats: ResultatRecherche[] } {
  if (v.pertinenceGlobale < SEUIL_PERTINENT) return { statut: 'aucune', resultats: [] };
  const resultats = fiches
    .filter((f) => (v.scores[f.code] ?? 0) >= SEUIL_PERTINENT)
    .sort((a, b) => (v.scores[b.code] ?? 0) - (v.scores[a.code] ?? 0) || a.code.localeCompare(b.code))
    .slice(0, MAX_RESULTATS)
    .map((f) => ({ code: f.code, nom: f.nom, score: arrondi(v.scores[f.code] ?? 0), faits: f.faits }));
  return { statut: statutParNombre(resultats.length), resultats };
}
