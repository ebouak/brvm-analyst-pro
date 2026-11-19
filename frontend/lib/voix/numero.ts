import { createHmac } from 'node:crypto';
import { normaliserTelephone } from '@/lib/crm/telephone';

/**
 * Numéros des appels vocaux. PUR (aucun accès réseau ni base).
 *
 * La saisie passe par `normaliserTelephone` (lib/crm/telephone.ts) : même règle
 * qu'en base (0174, 0250), indicatif EXIGÉ — deviner un pays ferait appeler un
 * inconnu par un robot.
 */
export const RE_E164 = /^\+[1-9]\d{7,14}$/;

export function estE164(s: string | null | undefined): s is string {
  return typeof s === 'string' && RE_E164.test(s);
}

/** Longueur minimale du secret d'empreinte : en dessous, il se devine. */
export const SECRET_HASH_MIN = 32;

/**
 * Empreinte HMAC-SHA256 (hex) d'un numéro E.164. C'est la seule forme du
 * numéro stockée dans `appels_vocaux` et `oppositions_vocales`. Sans secret
 * suffisant on LÈVE : une empreinte sans sel se retrouverait par force brute
 * (l'espace des numéros est petit).
 */
export function hacherNumero(e164: string, secret: string | undefined): string {
  if (!secret || secret.length < SECRET_HASH_MIN) {
    throw new Error('BLAND_HASH_SECRET absent ou trop court (32 caractères minimum).');
  }
  if (!estE164(e164)) throw new Error('numéro non E.164');
  return createHmac('sha256', secret).update(`voix:${e164}`).digest('hex');
}

export type ChampsRappel =
  | { ok: true; telephone: string | null; consentAt: string | null }
  | { ok: false; erreur: string };

/**
 * Champs « rappel vocal » du formulaire de contact. Sans case cochée, le
 * numéro N'EST PAS enregistré, même s'il a été saisi. Case cochée : le numéro
 * est exigé et validé ; le consentement est daté par le SERVEUR.
 */
export function champsRappel(entree: { telephone?: unknown; consent?: unknown }, maintenant: Date): ChampsRappel {
  if (entree.consent !== true) return { ok: true, telephone: null, consentAt: null };
  const saisie = typeof entree.telephone === 'string' ? entree.telephone.slice(0, 40) : '';
  const r = normaliserTelephone(saisie);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  if (!r.e164) return { ok: false, erreur: 'Indiquez le numéro auquel vous rappeler.' };
  return { ok: true, telephone: r.e164, consentAt: maintenant.toISOString() };
}
