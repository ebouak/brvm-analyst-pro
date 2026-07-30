import type { ThesisStatus } from './pure/status.js';

/**
 * Décide si une transition de statut mérite une notification : front montant
 * uniquement vers 'a-revoir'. Pas de répétition tant que le statut y reste
 * (un titre durablement décroché ne doit pas spammer l'utilisateur), pas de
 * notification sur 'objectif-atteint' (positif, hors périmètre de #15).
 */
export function shouldNotify(statutActuel: ThesisStatus, statutPrecedent: ThesisStatus | null): boolean {
  return statutActuel === 'a-revoir' && statutPrecedent !== 'a-revoir';
}
