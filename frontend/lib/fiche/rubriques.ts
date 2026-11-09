/**
 * Rubriques de la fiche action : une seule s'affiche à la fois, choisie par
 * le paramètre `?rubrique=`. L'adresse se partage, le rendu reste serveur.
 * Les anciennes ancres (#dividendes, #liquidite…) sont rattachées à leur
 * rubrique pour que les liens existants continuent de mener au bon endroit.
 */

export const RUBRIQUES = [
  { id: 'vue-ensemble', label: 'Vue d’ensemble' },
  { id: 'aujourdhui', label: 'Aujourd’hui' },
  { id: 'titre', label: 'Le titre' },
  { id: 'entreprise', label: 'L’entreprise' },
  { id: 'suivi', label: 'Mon suivi' },
] as const;

export type Rubrique = (typeof RUBRIQUES)[number]['id'];

const IDS = new Set<string>(RUBRIQUES.map((r) => r.id));

export function rubriqueDepuis(param: string | string[] | undefined): Rubrique {
  const v = Array.isArray(param) ? param[0] : param;
  return v && IDS.has(v) ? (v as Rubrique) : 'vue-ensemble';
}

/** Ancres historiques de la page longue → rubrique qui les contient désormais. */
const ANCRES: Record<string, Rubrique> = {
  'vue-ensemble': 'vue-ensemble', essentiel: 'vue-ensemble', 'analyse-ia': 'vue-ensemble',
  aujourdhui: 'aujourdhui', liquidite: 'aujourdhui', carnet: 'aujourdhui',
  titre: 'titre', technique: 'titre',
  entreprise: 'entreprise', fondamentaux: 'entreprise', valorisation: 'entreprise', dividendes: 'entreprise', profil: 'entreprise',
  suivi: 'suivi', these: 'suivi', discussions: 'suivi',
  'actualites-officielles': 'vue-ensemble',
};

export function rubriqueDeAncre(hash: string): Rubrique | null {
  const id = hash.replace(/^#/, '');
  return ANCRES[id] ?? null;
}

/** Lien relatif vers une rubrique ; conserve la période du graphique (`from`). */
export function hrefRubrique(id: Rubrique, from: string): string {
  const p = new URLSearchParams();
  if (id !== 'vue-ensemble') p.set('rubrique', id);
  if (from) p.set('from', from);
  return `?${p.toString()}#rubrique`;
}
