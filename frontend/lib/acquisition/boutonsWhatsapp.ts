import { normaliserSrc } from '@/lib/acquisition/suivi';

/**
 * Liens des trois boutons WhatsApp (Chaîne, écrire au service, alertes) — PUR.
 *
 * La Chaîne passe par `cheminSuivi('chaine', src)` (lib/acquisition/suivi.ts) ;
 * ce module construit les deux autres.
 */

/** Page où un compte lie son WhatsApp et règle ses alertes (WhatsAppPrefs en tête). */
export const CHEMIN_ALERTES = '/parametres/alertes';

/** Texte prérempli : la commande AIDE répond sans IA et liste les commandes. */
export const TEXTE_ECRIRE = 'AIDE';

/**
 * Lien wa.me vers le numéro du service, AIDE prérempli, ou null si le numéro
 * est absent ou manifestement incomplet (le bouton ne s'affiche alors pas).
 * Même normalisation que le reste du site : on ne garde que les chiffres.
 */
export function lienEcrireWhatsapp(numero: string | null | undefined): string | null {
  const chiffres = (numero ?? '').replace(/\D/g, '');
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(TEXTE_ECRIRE)}`;
}

/**
 * Lien « Recevoir mes alertes ».
 *
 * - Connecté (page qui le sait déjà, ex. /dashboard) : directement la page des alertes.
 * - Sinon (pages ISR, qui ne lisent pas la session) : /signup avec la source et
 *   `next`. Un anonyme crée son compte gratuit, passe par l'écran WhatsApp des
 *   nouveaux comptes puis arrive sur ses alertes ; un connecté est renvoyé vers
 *   `next` par le middleware (`destinationInscritConnecte`), sans rendu de /signup.
 *
 * Pourquoi pas `/bienvenue/whatsapp` : cet écran renvoie ailleurs tout compte de
 * plus de 24 h ; un ancien compte n'y verrait jamais la liaison.
 */
export function lienAlertesWhatsapp(src: string, connecte = false): string {
  if (connecte) return CHEMIN_ALERTES;
  return `/signup?src=${encodeURIComponent(normaliserSrc(src))}&next=${encodeURIComponent(CHEMIN_ALERTES)}`;
}
