// Libellés d'état d'une action du journal — une seule table. Jamais « reçu » : le journal ne sait pas si le message est lu.
export const LIB_STATUT: Record<string, string> = {
  envoye: 'envoyé', prepare: 'préparé, non envoyé', echec: 'échec', envoi: 'en cours',
};
export const libStatut = (s: string): string => LIB_STATUT[s] ?? s;
