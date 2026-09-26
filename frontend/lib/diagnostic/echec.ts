/**
 * Signalement d'un échec de génération, sur un canal distinct du contenu.
 *
 * POURQUOI CE MODULE. La route `/api/diagnostic/[code]` diffuse le rapport en
 * flux. Quand tous les fournisseurs échouaient, elle écrivait la phrase
 * « [Erreur : tous les fournisseurs LLM ont échoué] » DANS LE FLUX DE CONTENU.
 * Le client ne pouvait pas la distinguer d'un rapport : il l'affichait comme
 * une analyse, sous l'en-tête « Rapport du … », avec un bouton PDF à côté.
 * Constaté en production sur une valeur réelle.
 *
 * Le statut HTTP ne peut pas servir : il est arrêté à 200 dès que la réponse
 * en flux est renvoyée, avant que le premier fournisseur soit interrogé. D'où
 * un marqueur, reconnaissable et impossible à confondre avec de la prose —
 * il contient un octet nul, qu'aucun modèle n'émet.
 *
 * Le message, lui, est écrit pour un lecteur : il ne nomme ni les
 * fournisseurs, ni la technique, et dit quoi faire.
 */

/** Marqueur machine. Ne jamais l'afficher : le client le remplace par le message. */
export const MARQUE_ECHEC = '\u0000WB_DIAGNOSTIC_ECHEC\u0000';

/** Ce que lit la personne. */
export const MESSAGE_ECHEC =
  "L’analyse n’a pas pu être produite pour le moment. Réessayez dans quelques minutes.";
