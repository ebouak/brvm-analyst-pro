// frontend/lib/whatsappAgent/pairing.ts
import { randomInt } from 'node:crypto';

// Alphabet sans caractères ambigus (O/0, I/1) : le code est lu à l'écran
// puis retapé à la main dans WhatsApp.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const PAIRING_RE = /^WB-[A-Z0-9]{6}$/;

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
