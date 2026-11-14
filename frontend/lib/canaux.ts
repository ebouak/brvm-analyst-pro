/**
 * Canaux publics WESTBOURSE, source unique (site, vidéos, e-mails).
 * Les valeurs reprennent remotion/canaux.json (« numero », « chaine », « telegram »).
 */
export const CANAUX = {
  /** Chaîne WhatsApp : la vidéo de séance chaque soir, sans compte. */
  whatsappChaine: 'https://whatsapp.com/channel/0029VbDkKjK5K3zL18MshI0d',
  /** Canal Telegram public. */
  telegram: 'https://t.me/westbourse7',
  /** Numéro du service WhatsApp (commandes AIDE, COURS…). */
  whatsappNumero: '+33 7 43 65 72 71',
} as const;

/** Lien wa.me vers le numéro du service, avec un texte prérempli facultatif. */
export function lienWhatsappNumero(texte?: string): string {
  const n = CANAUX.whatsappNumero.replace(/\D/g, '');
  return `https://wa.me/${n}${texte ? `?text=${encodeURIComponent(texte)}` : ''}`;
}
