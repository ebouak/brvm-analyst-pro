import type { ObjectifId } from './capsules';
import type { Niveau } from './types';

/**
 * Quiz de placement rapide en 5 questions — PUR, testé.
 * Permet à un visiteur ou membre d'identifier en 2 minutes le niveau BRVM
 * le mieux adapté à ses acquis actuels, sans collecte ni promesse.
 */

export interface QuestionPlacement {
  id: string;
  theme: string;
  question: string;
  options: string[];
  correct: number;
  explication: string;
}

export const QUESTIONS_PLACEMENT: readonly QuestionPlacement[] = [
  {
    id: 'place-1',
    theme: 'Acteurs & fonctionnement',
    question: 'À la BRVM, quel acteur tient votre compte-titres, exécute vos ordres et constitue votre premier interlocuteur en cas de dividende manquant ?',
    options: [
      'La BRVM directement',
      'Une SGI agréée par l’AMF-UMOA',
      'La société cotée concernée',
      'Le Dépositaire Central (DC/BR) en direct',
    ],
    correct: 1,
    explication: 'Seules les Sociétés de Gestion et d’Intermédiation (SGI) agréées transmettent vos ordres et gèrent votre compte-titres ; le DC/BR assure le règlement-livraison en arrière-plan.',
  },
  {
    id: 'place-2',
    theme: 'Dividendes & fiscalité',
    question: 'Vous achetez une action le matin même de sa date de détachement (ex-dividende). Que se passe-t-il pour le dividende de l’exercice ?',
    options: [
      'Vous touchez l’intégralité du dividende',
      'Vous touchez la moitié du dividende',
      'Le dividende revient au vendeur et le cours s’ajuste à la baisse',
      'Le dividende est annulé par la SGI',
    ],
    correct: 2,
    explication: 'Pour recevoir le dividende, il faut détenir le titre à la clôture de la veille du détachement ; au détachement, le cours est ajusté techniquement à la baisse.',
  },
  {
    id: 'place-3',
    theme: 'Analyse fondamentale',
    question: 'Une banque affiche un PER très bas (4×), mais son résultat net recule depuis trois ans tandis que son coût du risque bondit. Que faut-il vérifier en priorité ?',
    options: [
      'S’il ne s’agit pas d’un « value trap » lié à une dégradation des bénéfices',
      'Uniquement son cours unitaire en FCFA',
      'La couleur de ses dernières bougies journalières',
      'Si l’action cote en dessous de 5 000 FCFA',
    ],
    correct: 0,
    explication: 'Un PER bas peut signaler une décote injustifiée ou au contraire des bénéfices passés non soutenables (value trap).',
  },
  {
    id: 'place-4',
    theme: 'Analyse technique & liquidité',
    question: 'À la BRVM, une action peu échangée reste figée au même cours pendant dix séances d’affilée. Pourquoi son MACD tend-il mécaniquement vers zéro ?',
    options: [
      'Parce qu’un rallye haussier est imminent',
      'Parce que ses deux moyennes exponentielles convergent vers le prix figé',
      'Parce que la BRVM suspend le calcul du MACD',
      'Parce que le flottant vient d’être doublé',
    ],
    correct: 1,
    explication: 'Quand les clôtures restent identiques faute d’échanges, les moyennes courte et longue convergent vers ce même cours : le resserrement du MACD reflète l’absence de volume, pas un signal.',
  },
  {
    id: 'place-5',
    theme: 'Marché primaire & DPS',
    question: 'Lors d’une augmentation de capital avec maintien des Droits Préférentiels de Souscription (DPS), quel choix entraîne une perte sèche certaine ?',
    options: [
      'Exercer ses DPS pour souscrire',
      'Céder ses DPS sur le marché pendant l’opération',
      'Ne rien faire et laisser expirer ses DPS',
      'Exercer une partie et vendre le solde',
    ],
    correct: 2,
    explication: 'Au détachement des DPS, le cours baisse d’environ leur valeur théorique ; laisser expirer ses droits sans exercer ni vendre fait subir la dilution sans compensation.',
  },
] as const;

export interface ResultatPlacement {
  score: number;
  total: number;
  niveau: Niveau;
  slugRecommande: string;
  objectifSuggere: ObjectifId;
  titre: string;
  raison: string;
  details: { id: string; juste: boolean; explication: string }[];
}

export function evaluerPlacement(reponses: readonly number[]): ResultatPlacement {
  const details = QUESTIONS_PLACEMENT.map((q, i) => ({
    id: q.id,
    juste: reponses[i] === q.correct,
    explication: q.explication,
  }));
  const score = details.filter((d) => d.juste).length;
  const total = QUESTIONS_PLACEMENT.length;

  if (score <= 2) {
    return {
      score,
      total,
      niveau: 'debutant',
      slugRecommande: 'academy-niveau-1-initiation',
      objectifSuggere: 'debuter',
      titre: 'Niveau 1 — Initiation à la BRVM recommandé',
      raison: 'Commencez par les bases solides : acteurs (BRVM, AMF-UMOA, SGI, DC/BR), frais réels, détachement du dividende et premier budget.',
      details,
    };
  }
  if (score === 3) {
    return {
      score,
      total,
      niveau: 'intermediaire',
      slugRecommande: 'academy-niveau-2-fondamental',
      objectifSuggere: 'dividendes',
      titre: 'Niveau 2 — Analyse Fondamentale recommandé',
      raison: 'Vos bases sur le marché sont acquises. Passez à l’analyse des états financiers, des banques UEMOA, du PER/ROE et des dividendes.',
      details,
    };
  }
  if (score === 4) {
    return {
      score,
      total,
      niveau: 'avance',
      slugRecommande: 'academy-niveau-3-technique',
      objectifSuggere: 'technique',
      titre: 'Niveau 3 — Analyse Technique recommandé',
      raison: 'Vous maîtrisez déjà l’essentiel du fondamental. Approfondissez la lecture des graphiques, la liquidité BRVM, le RSI, le MACD et le risque.',
      details,
    };
  }
  return {
    score,
    total,
    niveau: 'expert',
    slugRecommande: 'academy-niveau-4-expert',
    objectifSuggere: 'certification',
    titre: 'Niveau 4 — Expert recommandé (ou révision vers la certification)',
    raison: 'Score parfait sur les 5 piliers ! Vous pouvez attaquer directement le niveau Expert et viser la certification complète des 4 niveaux.',
    details,
  };
}
