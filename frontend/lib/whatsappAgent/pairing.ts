// frontend/lib/whatsappAgent/pairing.ts
import { randomInt } from 'node:crypto';

// Alphabet sans caractères ambigus (O/0, I/1) : le code est lu à l'écran
// puis retapé à la main dans WhatsApp.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// Volontairement plus permissive que ALPHABET ([A-Z0-9] accepte O/0/I/1) :
// l'utilisateur qui confond O et Q reçoit « code inconnu, régénérez » plutôt
// que de voir son code partir dans l'agent conversationnel, qui lui
// répondrait n'importe quoi. Coût : un aller-retour base inutile.
const PAIRING_RE = /^WB-[A-Z0-9]{6}$/;

/**
 * Durée de validité d'un code. SEULE source de vérité : la génération
 * (paramètres), la validation (webhook) et les messages affichés à
 * l'utilisateur doivent tous en dériver, jamais réécrire « 15 » en dur.
 */
export const PAIRING_TTL_MINUTES = 15;

/** Horodatage d'expiration à stocker dans whatsapp_pairing_codes.expires_at. */
export function pairingExpiresAt(now = Date.now()): string {
  return new Date(now + PAIRING_TTL_MINUTES * 60_000).toISOString();
}

/** Code d'appairage à usage unique, affiché par l'interface des paramètres. */
export function generatePairingCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `WB-${s}`;
}

/**
 * Un message WhatsApp entrant est-il un code d'appairage plutôt qu'une
 * question à l'agent ? Testé AVANT le traitement conversationnel normal.
 */
export function isPairingCode(text: string): boolean {
  return PAIRING_RE.test(text.trim().toUpperCase());
}

/** Normalise un message entrant en code comparable à celui stocké. */
export function normalizePairingCode(text: string): string {
  return text.trim().toUpperCase();
}
