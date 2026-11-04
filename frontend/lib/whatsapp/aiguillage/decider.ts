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

/** Au-delà, une intention à risque (conseil, analyse, humain) interdit la réponse « nom seul ». */
export const RISQUE_NOM_SEUL = 0.2;

const societesSures = (v: AiguillageValide) =>
  Object.entries(v.societes)
    .filter(([, s]) => s >= SEUIL_SOCIETE)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c]) => c);

/**
 * Message réduit à une société (« sonatel », « SNTS ? ») : Jev reconnaît la société
 * sans douter, mais hésite sur la demande (mesuré : cours 0,49 à 0,66). On répond
 * par son cours — un fait, pas une recommandation — si rien n'évoque un conseil,
 * une analyse ou une demande d'humain.
 */
function nomSeul(v: AiguillageValide): Decision | null {
  if (v.intention !== 'cours' && v.intention !== 'dividendes' && v.intention !== 'autre') return null;
  const risque = Math.max(v.probabilites.conseil ?? 0, v.probabilites.analyse ?? 0, v.probabilites.humain ?? 0);
  if (risque >= RISQUE_NOM_SEUL) return null;
  const codes = societesSures(v);
  if (codes.length !== 1) return null;
  return { type: 'commande', commande: { type: v.intention === 'dividendes' ? 'dividendes' : 'cours', valeur: codes[0]! } };
}

/** Réponse validée → action. Le doute retombe TOUJOURS sur le chemin actuel. */
export function decider(v: AiguillageValide): Decision {
  const p = v.probabilites[v.intention] ?? 0;
  const second = Math.max(0, ...Object.entries(v.probabilites).filter(([k]) => k !== v.intention).map(([, x]) => x ?? 0));
  if (p < SEUIL_INTENTION || p - second < MARGE_INTENTION) return nomSeul(v) ?? { type: 'aiguillage_actuel' };

  switch (v.intention) {
    case 'cours':
    case 'dividendes': {
      const codes = societesSures(v);
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
