/**
 * Libellé de suivi d'une relance — PUR. Dit ce que l'on SAIT, rien de plus :
 * « envoyé » signifie remis à Resend, jamais « reçu » (seul le webhook de
 * livraison, ou une réponse, le prouve).
 */
import type { ActionCrm } from './types';

export type LibelleSuivi =
  | 'envoyé' | 'livré' | 'remise retardée' | 'échec' | 'signalé comme spam' | 'réponse reçue'
  | 'préparé, non envoyé' | "échec d'envoi";

export function libelleSuivi(action: Pick<ActionCrm, 'statut' | 'livraison'>, reponseRecueApres: boolean): LibelleSuivi {
  if (action.statut === 'echec') return "échec d'envoi";
  // Préparé (WhatsApp) ou encore en cours d'envoi : rien n'est parti à coup sûr.
  if (action.statut !== 'envoye') return 'préparé, non envoyé';
  if (reponseRecueApres) return 'réponse reçue';
  switch (action.livraison ?? null) {
    case 'remis': return 'livré';
    case 'retarde': return 'remise retardée';
    case 'rejete': return 'échec';
    case 'spam': return 'signalé comme spam';
    default: return 'envoyé';
  }
}
