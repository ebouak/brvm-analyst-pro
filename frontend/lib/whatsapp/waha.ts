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

export type EvenementWaha =
  | { type: 'message'; id: string; de: string; texte: string; deMoi: boolean; media: boolean; horodatage: number | null }
  | { type: 'session.status'; session: string | null; statut: string };

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
    };
  }
  if (c.event === 'session.status') {
    if (typeof p.status !== 'string' || !p.status) return null;
    return { type: 'session.status', session: typeof c.session === 'string' ? c.session : null, statut: p.status };
  }
  return null;
}
