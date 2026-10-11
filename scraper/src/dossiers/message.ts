/**
 * Texte du message hebdomadaire — PUR, testé.
 *
 * AUCUN CHIFFRE hors dates. Les chiffres vivent dans les PDF, où ils ont été
 * vérifiés ligne à ligne par le constructeur du dossier. En remettre ici
 * créerait une SECONDE source à tenir juste — et un jour les deux
 * divergeraient, le message annonçant un cours que la pièce jointe contredit.
 * Le test « AUCUN chiffre » fait respecter cette règle à chaque retouche du
 * gabarit ; s'il casse, c'est le gabarit qu'il faut corriger, pas le test.
 *
 * Texte brut, pas de HTML : lisible dans tous les clients, rien à échapper,
 * et identique sur Telegram où le HTML n'aurait pas cours.
 */
import type { Selection } from './selection.js';

export interface Message {
  sujet: string;
  corps: string;
}

/** AAAA-MM-JJ → JJ/MM/AAAA. Les dates sont la seule donnée chiffrée admise. */
function dateFR(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/**
 * Rectificatif — envoyé aux comptes qui ont reçu un dossier fautif.
 *
 * Il dit CE qui était faux, en mots et sans chiffre (même règle que le message
 * hebdomadaire : les chiffres justes sont dans les pièces jointes), et que les
 * pièces jointes REMPLACENT les précédentes. Un porteur qui a lu « chiffre
 * d'affaires en recul » doit savoir que c'était faux, pas seulement recevoir
 * un nouveau fichier sans explication.
 */
export function composerRectificatif(sel: Selection, semaine: string, canal: 'email' | 'telegram'): Message {
  const sujet = `Rectificatif — vos dossiers valeur de la semaine du ${dateFR(semaine)}`;
  const jointes = canal === 'email' ? sel.pieces_jointes_email : sel.retenues;
  const lignes: string[] = [
    sujet,
    '',
    `Les dossiers valeur envoyés la semaine du ${dateFR(semaine)} comportaient une erreur de période :`,
    'certains panneaux comparaient un trimestre à un semestre ou à un exercice annuel.',
    'Cela a pu afficher à tort une baisse du chiffre d’affaires, ou un résultat d’exploitation « non disponible ».',
    '',
    'Les dossiers corrigés ci-joints remplacent les précédents. Merci de ne plus tenir compte des anciennes versions :',
  ];
  for (const l of jointes) lignes.push(`  • ${l.code} — ${l.designation}`);
  if (canal === 'email' && sel.reste_email.length > 0) {
    lignes.push('', 'Également corrigés, sur votre portefeuille :');
    for (const l of sel.reste_email) lignes.push(`  • ${l.code} — ${l.designation}`);
    lignes.push('  https://www.westbourse.com/portefeuille');
  }
  lignes.push(
    '',
    'Nous vous prions de nous excuser pour cette erreur.',
    '',
    'Document d’information établi à partir des données Westbourse ; ne constitue pas un conseil en investissement.',
  );
  return { sujet, corps: lignes.join('\n') };
}

export function composerMessage(sel: Selection, semaine: string, canal: 'email' | 'telegram'): Message {
  const sujet = `Vos dossiers valeur — semaine du ${dateFR(semaine)}`;

  /* Telegram envoie un document par valeur, sans plafond : il annonce donc
     TOUTES les retenues. L'email est borné à ses pièces jointes, et renvoie
     le reste au portefeuille. */
  const jointes = canal === 'email' ? sel.pieces_jointes_email : sel.retenues;
  const reste = canal === 'email' ? sel.reste_email : [];

  const lignes: string[] = [sujet, ''];
  lignes.push(
    canal === 'email'
      ? 'Vous trouverez en pièces jointes le dossier de chaque valeur de votre portefeuille :'
      : 'Voici le dossier de chaque valeur de votre portefeuille :',
  );
  for (const l of jointes) lignes.push(`  • ${l.code} — ${l.designation} — dossier complet`);

  if (reste.length > 0) {
    lignes.push('', 'Également disponibles sur votre portefeuille (limite de pièces jointes atteinte) :');
    for (const l of reste) lignes.push(`  • ${l.code} — ${l.designation}`);
    lignes.push('  https://www.westbourse.com/portefeuille');
  }

  /* Les valeurs écartées sont NOMMÉES avec leur raison. Un dossier absent que
     l'on passe sous silence se lit comme un oubli ; expliqué, c'est une
     information — et cela évite qu'un porteur croie sa ligne ignorée. */
  if (sel.exclues.length > 0) {
    lignes.push('', 'Non envoyés cette semaine :');
    for (const e of sel.exclues) lignes.push(`  • ${e.code} — ${e.designation} : ${e.raison}`);
  }

  lignes.push(
    '',
    'Document d’information établi à partir des données Westbourse ; ne constitue pas un conseil en investissement.',
    '',
    'Vous recevez ce message parce que vous l’avez activé dans Paramètres › Alertes. Pour ne plus le recevoir : décochez la case.',
  );

  return { sujet, corps: lignes.join('\n') };
}
