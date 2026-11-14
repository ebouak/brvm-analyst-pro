/**
 * Texte du message d'envoi du relevé mensuel — PUR, testé.
 *
 * AUCUN CHIFFRE hors le mois et l'année : valeur, variation, dividendes vivent
 * dans le PDF, où chaque nombre a été calculé ligne à ligne. Les répéter ici
 * créerait une seconde source qui finirait par diverger (même règle que
 * `dossiers/message.ts`). Texte brut, identique sur e-mail et Telegram.
 */
import type { TypeReleve } from './types.js';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-10 » → « octobre 2026 ». */
export function libelleMois(mois: string): string {
  const [a, m] = mois.split('-');
  const nom = MOIS[Number(m) - 1];
  return nom ? `${nom} ${a}` : mois;
}

export interface Message { sujet: string; corps: string }

export function composerMessageReleve(mois: string, type: TypeReleve): Message {
  const simule = type === 'simule';
  const sujet = `Votre relevé de portefeuille${simule ? ' simulé' : ''} — ${libelleMois(mois)}`;
  const corps = [
    sujet,
    '',
    simule
      ? 'Vous n’avez pas encore enregistré de position réelle : ce relevé porte sur votre portefeuille simulé.'
      : 'Voici où en est votre portefeuille à la fin du mois, ligne par ligne.',
    'Le document joint détaille la valeur et la variation du mois, la contribution de chaque ligne,',
    'les dividendes, les publications des sociétés détenues et les rendez-vous du mois suivant.',
    '',
    'Retrouvez tous vos relevés : https://www.westbourse.com/premium/reports',
    '',
    'Vous recevez ce message parce que vous avez demandé l’envoi du relevé mensuel.',
    'Pour ne plus le recevoir, décochez-le dans vos préférences : https://www.westbourse.com/parametres/alertes',
    '',
    'Document d’information ; ne constitue pas un conseil en investissement.',
  ].join('\n');
  return { sujet, corps };
}
