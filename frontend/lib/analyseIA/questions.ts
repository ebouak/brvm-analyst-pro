/**
 * Questions proposées sous « Analyse par IA » (fiche action) et relances.
 * Module PUR. Des CONSTATS seulement : aucune question ne demande s'il faut
 * acheter, vendre ou conserver — le produit ne donne pas de conseil.
 */

export interface ValeurQuestions {
  code: string;
  nom: string | null;
  /** Dernier exercice annuel en base, sinon null. */
  exerciceComptes: number | null;
}

export function questionsProposees(v: ValeurQuestions): string[] {
  const nom = v.nom?.trim() || v.code;
  return [
    `Qu’est-ce qui a affecté le cours de ${v.code} récemment ?`,
    `Les dernières actualités de ${nom}`,
    v.exerciceComptes ? `Résume les comptes ${v.exerciceComptes} de ${nom}` : `Résume les derniers comptes de ${nom}`,
    'Que disent le RSI et le MACD aujourd’hui ?',
    'Quel est le risque à court terme ?',
    'Pourquoi ce signal aujourd’hui ?',
    'Comment ont évolué les dividendes ?',
    `Comment a évolué le cours de ${v.code} depuis un an ?`,
    `Le titre ${v.code} est-il facile à échanger ?`,
  ];
}

export function normaliserQuestion(q: string): string {
  return q
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trois relances déterministes (aucun LLM) : les questions proposées qui
 * suivent la dernière question posée, en boucle, hors questions déjà posées.
 */
export function relancesSuivantes(v: ValeurQuestions, posees: string[], n = 3): string[] {
  const toutes = questionsProposees(v);
  const dejas = new Set(posees.map(normaliserQuestion));
  let depart = 0;
  for (let i = posees.length - 1; i >= 0; i--) {
    const idx = toutes.findIndex((q) => normaliserQuestion(q) === normaliserQuestion(posees[i]!));
    if (idx >= 0) {
      depart = idx + 1;
      break;
    }
  }
  const sortie: string[] = [];
  for (let k = 0; k < toutes.length && sortie.length < n; k++) {
    const q = toutes[(depart + k) % toutes.length]!;
    if (!dejas.has(normaliserQuestion(q))) sortie.push(q);
  }
  return sortie;
}
