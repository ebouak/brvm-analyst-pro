/**
 * « Comprendre la séance » — module PUR et testé (spec §4.4).
 *
 * Constats DÉTERMINISTES, sans modèle de langage : chaque phrase est bâtie sur
 * une métrique nommée de l'entrée, et n'existe que si cette métrique existe.
 * Une donnée manquante supprime la phrase ; elle ne devient jamais 0.
 * Formulations neutres, au passé, sans cause affirmée, sans conseil.
 */
import { fmtNumber, fmtFcfa } from '@/lib/format';

export interface MetriquesSeance {
  dateMarche: string;
  hausses: number | null;
  baisses: number | null;
  stables: number | null;
  composite: { valeur: number; variationPct: number } | null;
  secteurMeneur: { nom: string; variationPct: number } | null;
  valeurEchangee: number | null;
  valeurEchangeeVeille: number | null;
  plusEchangee: { code: string; nom: string; valeur: number } | null;
}

export interface Constat {
  id: 'largeur' | 'composite' | 'secteur' | 'activite' | 'vedette';
  texte: string;
  sens: string;
}

const pctAbs = (v: number, d = 2) => `${fmtNumber(Math.abs(v), d)} %`;
const pctSigne = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${pctAbs(v, d)}`;

export function comprendreSeance(m: MetriquesSeance): Constat[] {
  const out: Constat[] = [];

  if (m.hausses != null && m.baisses != null && m.stables != null) {
    const qui =
      m.baisses > m.hausses ? 'ici, la baisse a été plus répandue que la hausse'
      : m.hausses > m.baisses ? 'ici, la hausse a été plus répandue que la baisse'
      : 'ici, hausses et baisses se sont équilibrées';
    out.push({
      id: 'largeur',
      texte:
        `${m.baisses} valeur${m.baisses > 1 ? 's ont' : ' a'} baissé, ` +
        `${m.hausses} ${m.hausses > 1 ? 'ont' : 'a'} monté et ` +
        `${m.stables} ${m.stables > 1 ? 'sont restées stables' : 'est restée stable'}.`,
      sens: `La largeur du marché dit si un mouvement est général ou limité à quelques titres : ${qui}.`,
    });
  }

  if (m.composite) {
    const { valeur, variationPct: v } = m.composite;
    out.push({
      id: 'composite',
      texte:
        Math.abs(v) < 0.2
          ? `Le BRVM Composite est resté quasi stable (${pctSigne(v)}) à ${fmtNumber(valeur, 2)} points.`
          : `Le BRVM Composite a ${v > 0 ? 'progressé' : 'reculé'} de ${pctAbs(v)} à ${fmtNumber(valeur, 2)} points.`,
      sens: "L'indice résume l'ensemble des actions cotées, pondérées par leur taille : une faible variation peut cacher de forts écarts entre valeurs.",
    });
  }

  if (m.secteurMeneur) {
    const { nom, variationPct: v } = m.secteurMeneur;
    out.push({
      id: 'secteur',
      texte: v > 0 ? `Le secteur ${nom} a le plus progressé (${pctSigne(v)}).` : `Le secteur ${nom} a le mieux résisté (${pctSigne(v)}).`,
      sens: 'Les indices sectoriels montrent dans quelle partie de la cote se concentrent les mouvements.',
    });
  }

  if (m.valeurEchangee != null && m.valeurEchangee > 0) {
    let texte = `${fmtFcfa(m.valeurEchangee)} FCFA ont été échangés`;
    if (m.valeurEchangeeVeille != null && m.valeurEchangeeVeille > 0) {
      const d = (m.valeurEchangee / m.valeurEchangeeVeille - 1) * 100;
      texte += Math.abs(d) < 0.05
        ? ', autant que la séance précédente'
        : `, en ${d > 0 ? 'hausse' : 'baisse'} de ${pctAbs(d, 1)} sur la séance précédente`;
    }
    out.push({
      id: 'activite',
      texte: `${texte}.`,
      sens: "La valeur échangée mesure l'activité de la séance, indépendamment du sens des cours.",
    });
  }

  if (m.plusEchangee) {
    out.push({
      id: 'vedette',
      texte: `La valeur la plus échangée a été ${m.plusEchangee.nom} (${m.plusEchangee.code}), avec ${fmtFcfa(m.plusEchangee.valeur)} FCFA.`,
      sens: "Une forte activité sur un titre ne dit pas s'il est cher ou bon marché.",
    });
  }

  return out;
}
