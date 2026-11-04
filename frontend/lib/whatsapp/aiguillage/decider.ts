import type { Commande } from '@/lib/whatsapp/commandes';
import type { AiguillageValide } from './valider';

export const SEUIL_INTENTION = 0.85;
export const MARGE_INTENTION = 0.5;
export const SEUIL_SOCIETE = 0.8;
export const MAX_AMBIGUES = 3;

export type Decision =
  | { type: 'commande'; commande: Commande }
  | { type: 'clarification'; intention: 'cours' | 'dividendes'; codes: string[] }
  | { type: 'refus_conseil' }
  | { type: 'salutation' }
  | { type: 'agent' }
  | { type: 'console' }
  | { type: 'aiguillage_actuel' };

/** Réponse validée → action. Le doute retombe TOUJOURS sur le chemin actuel. */
export function decider(v: AiguillageValide): Decision {
  const p = v.probabilites[v.intention] ?? 0;
  const second = Math.max(0, ...Object.entries(v.probabilites).filter(([k]) => k !== v.intention).map(([, x]) => x ?? 0));
  if (p < SEUIL_INTENTION || p - second < MARGE_INTENTION) return { type: 'aiguillage_actuel' };

  switch (v.intention) {
    case 'cours':
    case 'dividendes': {
      const codes = Object.entries(v.societes)
        .filter(([, s]) => s >= SEUIL_SOCIETE)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([c]) => c);
      if (codes.length === 1) return { type: 'commande', commande: { type: v.intention, valeur: codes[0]! } };
      return { type: 'clarification', intention: v.intention, codes: codes.length <= MAX_AMBIGUES ? codes : [] };
    }
    case 'palmares_hausses':
      return { type: 'commande', commande: { type: 'palmares', critere: 'hausses' } };
    case 'palmares_baisses':
      return { type: 'commande', commande: { type: 'palmares', critere: 'baisses' } };
    case 'palmares_volumes':
      return { type: 'commande', commande: { type: 'palmares', critere: 'volumes' } };
    case 'aide':
      return { type: 'commande', commande: { type: 'aide' } };
    case 'conseil':
      return { type: 'refus_conseil' };
    case 'salutation':
      return { type: 'salutation' };
    case 'analyse':
      return { type: 'agent' };
    case 'humain':
      return { type: 'console' };
    default:
      return { type: 'aiguillage_actuel' };
  }
}
