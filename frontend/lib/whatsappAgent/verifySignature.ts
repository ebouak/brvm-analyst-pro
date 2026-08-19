import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie la signature Meta (X-Hub-Signature-256) d'une requête webhook
 * WhatsApp Cloud API. `rawBody` doit être le corps BRUT de la requête (avant
 * tout parsing JSON) — le HMAC porte sur les octets exacts envoyés par Meta.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice('sha256='.length);
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}
