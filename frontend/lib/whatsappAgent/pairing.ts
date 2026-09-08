// frontend/lib/whatsappAgent/pairing.ts
/**
 * Réexportation du module partagé `lib/pairingCodes.ts`.
 *
 * Ce fichier portait l'implémentation, qui n'a jamais rien eu de spécifique à
 * WhatsApp : un code aléatoire, une durée de vie, une reconnaissance de forme.
 * Telegram en a le même besoin (migration 0129), et lui faire importer un
 * module `whatsappAgent/` aurait créé une dépendance trompeuse entre deux
 * canaux indépendants.
 *
 * Conservé comme façade plutôt que supprimé : les quatre appelants existants
 * — la route de génération, redeemPairing, le webhook et le test — continuent
 * de fonctionner sans modification, et la non-régression se prouve en
 * relançant `pairing.test.mjs` tel quel.
 */
export {
  PAIRING_TTL_MINUTES,
  pairingExpiresAt,
  generatePairingCode,
  isPairingCode,
  normalizePairingCode,
} from '@/lib/pairingCodes';
