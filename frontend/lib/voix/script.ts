import type { TypeAlerte } from './fenetre';

/**
 * Scripts FIXES des appels vocaux — PUR.
 *
 * Rien n'y vient d'une IA ni du message du visiteur : le numéro déclaré peut
 * appartenir à un tiers, donc l'appel ne lit ni prénom, ni contenu du message,
 * ni donnée de compte. Le modèle de Bland suit `task` pendant la conversation ;
 * `first_sentence` est prononcée telle quelle.
 */
export const ANNONCE = "Bonjour, ici l'assistant vocal automatisé de WESTBOURSE.";

/** Durée maximale d'un rappel (minutes, paramètre `max_duration` de Bland). */
export const DUREE_MAX_RAPPEL = 3;
/** Durée maximale d'une alerte exploitant (minutes). */
export const DUREE_MAX_ALERTE = 2;

export interface ParametresAppel {
  task: string;
  first_sentence: string;
  language: 'fr';
  max_duration: number;
  wait_for_greeting: boolean;
  record: false;
  transfer_phone_number?: string;
}

export const PREMIERE_PHRASE_RAPPEL =
  `${ANNONCE} Je vous appelle à la suite d'une demande de rappel laissée sur notre site. ` +
  'Si vous ne souhaitez pas être appelé, dites simplement « stop » et je raccroche.';

export const CONSIGNES_RAPPEL = [
  "Tu es l'assistant vocal automatisé de WESTBOURSE, une plateforme d'information sur la Bourse régionale des valeurs mobilières (BRVM). Tu parles français, avec des phrases courtes et polies.",
  "Tu as déjà annoncé que tu es un assistant automatisé et que tu rappelles à la suite d'une demande de rappel laissée sur le site. Ne lis jamais le contenu d'un message : tu ne le connais pas.",
  "Tu peux répondre aux questions générales suivantes : comment créer un compte ; ce que comprend le plan gratuit ; le portefeuille virtuel pour s'entraîner sans argent réel ; la formation Academy ; comment relier WhatsApp ou Telegram depuis la page Paramètres, rubrique Alertes. Pour le reste, propose d'écrire à support arobase westbourse point com.",
  "Tu ne donnes JAMAIS de conseil d'investissement, ni d'avis sur une action, ni aucun chiffre de marché (cours, variation, dividende, rendement, prix). Si on t'en demande, réponds que tu ne peux pas en donner et renvoie vers le site.",
  "Tu ne demandes AUCUNE donnée personnelle : ni nom, ni adresse e-mail, ni mot de passe, ni code, ni information bancaire. Si la personne en donne, ne les répète pas.",
  "Si la personne demande à parler à un humain, transfère l'appel. Ne propose pas le transfert de toi-même.",
  "Si la personne dit « stop », « ne m'appelez plus » ou demande à ne plus être appelée, confirme en une phrase qu'elle ne sera plus appelée, puis raccroche.",
  "Si la personne dit ne pas avoir demandé de rappel, excuse-toi en une phrase, confirme qu'elle ne sera plus appelée, puis raccroche.",
  "Sois bref. Raccroche poliment quand la personne n'a plus de question.",
].join('\n');

export function parametresRappel(numeroTransfert: string | null | undefined): ParametresAppel {
  return {
    task: CONSIGNES_RAPPEL,
    first_sentence: PREMIERE_PHRASE_RAPPEL,
    language: 'fr',
    max_duration: DUREE_MAX_RAPPEL,
    wait_for_greeting: true,
    record: false,
    ...(numeroTransfert ? { transfer_phone_number: numeroTransfert } : {}),
  };
}

export const LIBELLE_ALERTE: Record<TypeAlerte, string> = {
  seance_absente: 'la collecte de la séance est absente à la clôture',
  llm_panne_totale: "plus aucun fournisseur d'intelligence artificielle n'est utilisable",
  chariow_erreur: 'un paiement Chariow est en erreur',
  whatsapp_session: 'la session WhatsApp est hors service',
};

/** Longueur maximale du résumé lu au téléphone. */
export const RESUME_MAX = 240;

/**
 * Nettoie le résumé d'alerte avant de le faire lire : retire adresses e-mail,
 * URL, identifiants (UUID), suites de chiffres longues (numéros, identifiants) et emoji. Le texte
 * vient du code, mais ce filet garantit qu'aucune donnée personnelle ou
 * référence illisible ne part chez le sous-traitant vocal.
 */
export function nettoyerResume(resume: unknown): string {
  return String(resume ?? '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, ' ')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\+?\d[\d\s.-]{5,}\d/g, ' ')
    .replace(/[a-z]{2,6}_[A-Za-z0-9]{6,}/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, RESUME_MAX);
}

export function parametresAlerte(type: TypeAlerte, resume: unknown): ParametresAppel {
  const propre = nettoyerResume(resume);
  const phrase = `${ANNONCE} Alerte critique : ${LIBELLE_ALERTE[type]}.${propre ? ` ${propre}` : ''} Le détail est sur Telegram.`;
  return {
    task: [
      "Tu es l'assistant vocal automatisé de WESTBOURSE et tu appelles l'exploitant du service pour une alerte d'exploitation.",
      `Tu as lu l'alerte. Si on te demande de répéter, relis exactement ceci : « ${LIBELLE_ALERTE[type]}.${propre ? ` ${propre}` : ''} »`,
      "N'ajoute aucune information, aucun chiffre ni aucune hypothèse. Raccroche dès que la personne a entendu le message.",
    ].join('\n'),
    first_sentence: phrase,
    language: 'fr',
    max_duration: DUREE_MAX_ALERTE,
    wait_for_greeting: true,
    record: false,
  };
}
