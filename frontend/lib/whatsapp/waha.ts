import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Passerelle WhatsApp non officielle (WAHA) — logique pure.
 * Spec : docs/superpowers/specs/2026-10-23-whatsapp-passerelle-design.md
 *
 * Signature des webhooks (waha.devlike.pro/docs/how-to/events, vérifié le
 * 2026-10-23) : en-tête `X-Webhook-Hmac` = HMAC-SHA512 hexadécimal du corps BRUT,
 * avec la clé WHATSAPP_HOOK_HMAC_KEY du serveur (WAHA_WEBHOOK_HMAC_KEY ici).
 * L'horodatage `X-Webhook-Timestamp` n'est PAS signé : on ne s'en sert pas —
 * le rejeu est neutralisé par la déduplication sur l'identifiant de message.
 */

export const TEXTE_MAX = 4000;

export function verifierSignatureWaha(corpsBrut: string, entete: string | null, secret: string | undefined): boolean {
  if (!secret || !entete || !/^[0-9a-f]{128}$/i.test(entete.trim())) return false;
  const attendu = Buffer.from(createHmac('sha512', secret).update(corpsBrut, 'utf8').digest('hex'), 'utf8');
  const recu = Buffer.from(entete.trim().toLowerCase(), 'utf8');
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

/**
 * Conversation privée avec une personne : numéro (`@c.us`, `@s.whatsapp.net`)
 * ou identifiant anonyme (`@lid`), que WhatsApp substitue parfois au numéro.
 * Groupes, statuts et Chaînes sont ignorés : on ne répond jamais à un groupe.
 */
export function estConversationPrivee(chatId: string): boolean {
  return /^[0-9]+@(c\.us|s\.whatsapp\.net|lid)$/.test(chatId);
}

/** « +33 7 43 65 72 71 » ou « 0033743657271 » → « 33743657271@c.us » ; null si illisible. */
export function chatIdDepuisTelephone(telephone: string): string | null {
  const chiffres = telephone.replace(/[^\d]/g, '').replace(/^00/, '');
  return chiffres.length >= 8 && chiffres.length <= 15 ? `${chiffres}@c.us` : null;
}

export type LivraisonWaha = 'envoye' | 'remis' | 'rejete';

export type EvenementWaha =
  | {
      type: 'message'; id: string; de: string; texte: string; deMoi: boolean; media: boolean; horodatage: number | null; prenom: string | null;
      /** `app` = tapé sur le téléphone, `api` = envoyé par la passerelle (nos réponses). */
      source: string | null;
      /** Destinataire ; absent ou égal à `de` dans la conversation « Vous ». */
      vers: string | null;
    }
  | { type: 'session.status'; session: string | null; statut: string }
  | { type: 'message.ack'; id: string; livraison: LivraisonWaha };

/**
 * Prénom affiché par l'expéditeur (« pushName »), selon le moteur : GOWS
 * (`_data.Info.PushName`) ou WEBJS (`_data.notifyName`). Facultatif, choisi
 * par la personne elle-même : borné, nettoyé, jamais exigé.
 */
function prenomAffiche(p: Record<string, unknown>): string | null {
  const d = (p._data && typeof p._data === 'object' ? p._data : {}) as Record<string, unknown>;
  const info = (d.Info && typeof d.Info === 'object' ? d.Info : {}) as Record<string, unknown>;
  const brut = [info.PushName, d.notifyName, d.pushName, p.notifyName].find((x) => typeof x === 'string' && x.trim());
  // eslint-disable-next-line no-control-regex
  return typeof brut === 'string' ? brut.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80) || null : null;
}

/**
 * Accusés WhatsApp (ack) : -1 ERROR, 0 PENDING, 1 SERVER, 2 DEVICE, 3 READ,
 * 4 PLAYED. « Remis » dès l'arrivée sur le téléphone ; « en attente » n'apporte rien.
 */
function livraisonDepuisAck(ack: unknown, nom: unknown): LivraisonWaha | null {
  const n = typeof ack === 'number' ? ack : null;
  const s = typeof nom === 'string' ? nom.toUpperCase() : '';
  if (n === -1 || s === 'ERROR') return 'rejete';
  if (n === 1 || s === 'SERVER') return 'envoye';
  if ((n !== null && n >= 2) || s === 'DEVICE' || s === 'READ' || s === 'PLAYED') return 'remis';
  return null;
}

/**
 * Message du compte WESTBOURSE à LUI-MÊME, tapé À LA MAIN dans la conversation
 * « Vous » : c'est ainsi que l'exploitant teste les commandes, l'appairage,
 * RECAP et l'agent sans second téléphone.
 *
 * Trois conditions, toutes nécessaires :
 *  - `deMoi` : envoyé depuis le numéro WESTBOURSE ;
 *  - `source === 'app'` : tapé sur le téléphone. Nos réponses partent par
 *    l'API (`source === 'api'`) et restent ignorées : AUCUNE BOUCLE possible,
 *    le bot ne peut pas se répondre à lui-même ;
 *  - pas d'autre destinataire : un message que l'exploitant tape depuis son
 *    téléphone dans la conversation d'un CLIENT n'est jamais traité comme une
 *    commande.
 */
export function estAutoTest(ev: { deMoi: boolean; source: string | null; de: string; vers: string | null }): boolean {
  return ev.deMoi && ev.source === 'app' && (!ev.vers || ev.vers === ev.de);
}

export function lireEvenementWaha(corps: unknown): EvenementWaha | null {
  if (!corps || typeof corps !== 'object') return null;
  const c = corps as { event?: unknown; session?: unknown; payload?: unknown };
  const p = (c.payload && typeof c.payload === 'object' ? c.payload : {}) as Record<string, unknown>;

  if (c.event === 'message') {
    if (typeof p.id !== 'string' || !p.id || typeof p.from !== 'string' || !p.from) return null;
    return {
      type: 'message',
      id: p.id,
      de: p.from,
      texte: typeof p.body === 'string' ? p.body.slice(0, TEXTE_MAX) : '',
      deMoi: p.fromMe === true,
      media: p.hasMedia === true,
      horodatage: typeof p.timestamp === 'number' ? p.timestamp : null,
      prenom: prenomAffiche(p),
      source: typeof p.source === 'string' ? p.source : null,
      vers: typeof p.to === 'string' && p.to ? p.to : null,
    };
  }
  if (c.event === 'message.ack') {
    if (typeof p.id !== 'string' || !p.id) return null;
    const livraison = livraisonDepuisAck(p.ack, p.ackName);
    return livraison ? { type: 'message.ack', id: p.id, livraison } : null;
  }
  if (c.event === 'session.status') {
    if (typeof p.status !== 'string' || !p.status) return null;
    return { type: 'session.status', session: typeof c.session === 'string' ? c.session : null, statut: p.status };
  }
  return null;
}
