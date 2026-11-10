/**
 * Rubriques de la fiche action : une seule s'affiche à la fois (`?rubrique=`).
 * Chaque rubrique répond à UNE question du lecteur (spec v2 § 1.2). Les anciennes
 * valeurs et les anciennes ancres restent valides : un lien partagé ne casse pas.
 */
export const RUBRIQUES = [
  { id: 'synthese', label: 'Synthèse', groupe: 'note', question: 'Que faut-il retenir, et avec quel degré de confiance ?' },
  { id: 'societe', label: 'Société', groupe: 'note', question: 'Que fait-elle et qui la contrôle ?' },
  { id: 'resultats', label: 'Résultats', groupe: 'note', question: 'Gagne-t-elle de l’argent, et de mieux en mieux ?' },
  { id: 'valorisation', label: 'Valorisation et dividendes', groupe: 'note', question: 'Est-ce cher, et que me verse-t-elle ?' },
  { id: 'marche', label: 'Cours et liquidité', groupe: 'note', question: 'Puis-je acheter et revendre, à quel coût ?' },
  { id: 'actualites', label: 'Actualités et calendrier', groupe: 'note', question: 'Qu’est-ce qui a changé, qu’est-ce qui arrive ?' },
  { id: 'suivi', label: 'Mon suivi', groupe: 'perso', question: 'Où en est ma propre thèse ?' },
] as const;

export type Rubrique = (typeof RUBRIQUES)[number]['id'];

const IDS = new Set<string>(RUBRIQUES.map((r) => r.id));

/** Valeurs de `?rubrique=` livrées par la PR #201 (5 rubriques). */
const ANCIENNES: Record<string, Rubrique> = {
  'vue-ensemble': 'synthese', aujourdhui: 'marche', titre: 'marche', entreprise: 'societe',
};

export function rubriqueDepuis(param: string | string[] | undefined): Rubrique {
  const v = Array.isArray(param) ? param[0] : param;
  if (!v) return 'synthese';
  if (IDS.has(v)) return v as Rubrique;
  return ANCIENNES[v] ?? 'synthese';
}

/** Ancres historiques → rubrique qui les contient désormais. */
const ANCRES: Record<string, Rubrique> = {
  synthese: 'synthese', 'vue-ensemble': 'synthese', essentiel: 'synthese', 'analyse-ia': 'synthese', lecture: 'synthese',
  societe: 'societe', entreprise: 'societe', profil: 'societe', direction: 'societe', actionnariat: 'societe', identite: 'societe',
  resultats: 'resultats', fondamentaux: 'resultats', exercice: 'resultats', ifrs: 'resultats', 'points-cles': 'resultats',
  valorisation: 'valorisation', dividendes: 'valorisation', multiples: 'valorisation',
  marche: 'marche', aujourdhui: 'marche', titre: 'marche', liquidite: 'marche', carnet: 'marche', seance: 'marche',
  cours: 'marche', technique: 'marche', saisonnalite: 'marche',
  actualites: 'actualites', evenements: 'actualites', calendrier: 'actualites', 'actualites-officielles': 'actualites',
  suivi: 'suivi', these: 'suivi', discussions: 'suivi', outils: 'suivi',
};

export function rubriqueDeAncre(hash: string): Rubrique | null {
  return ANCRES[hash.replace(/^#/, '')] ?? null;
}

/** Lien relatif vers une rubrique ; conserve la période du graphique (`from`). */
export function hrefRubrique(id: Rubrique, from: string, ancre = 'rubrique'): string {
  const p = new URLSearchParams();
  if (id !== 'synthese') p.set('rubrique', id);
  if (from) p.set('from', from);
  return `?${p.toString()}#${ancre}`;
}
