import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Lien signé de la récap : permet aux envois automatiques (point du soir,
 * scraper / worker vidéo) d'obtenir l'image d'UN utilisateur sans session,
 * pendant quelques minutes seulement.
 *
 * Signature HMAC-SHA256 de `u.exp` avec RECAP_SECRET (Vercel + GitHub). Le
 * lien n'est jamais publié : il ne circule qu'entre nos workers et la route.
 * Durée de vie bornée à DUREE_MAX_S, même si l'appelant demande plus.
 *
 * Copie conforme dans scraper/src/recap/signature.ts et video/recapSignature.mjs
 * (paquets distincts) : toute correction est à reporter des trois côtés.
 */
export const DUREE_MAX_S = 600;

function hmac(userId: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${userId}.${exp}`).digest('hex');
}

export function signerRecap(userId: string, secret: string, maintenantS = Math.floor(Date.now() / 1000), dureeS = 300) {
  const exp = maintenantS + Math.min(dureeS, DUREE_MAX_S);
  return { u: userId, exp, sig: hmac(userId, exp, secret) };
}

export function verifierRecap(
  p: { u: string | null; exp: string | null; sig: string | null },
  secret: string | undefined,
  maintenantS = Math.floor(Date.now() / 1000),
): string | null {
  // Secret absent ou trop court : la voie signée est fermée, jamais ouverte par défaut.
  if (!secret || secret.length < 32 || !p.u || !p.exp || !p.sig) return null;
  const exp = Number(p.exp);
  if (!Number.isInteger(exp) || exp < maintenantS || exp > maintenantS + DUREE_MAX_S) return null;
  if (!/^[0-9a-f-]{36}$/i.test(p.u) || !/^[0-9a-f]{64}$/.test(p.sig)) return null;
  const attendu = Buffer.from(hmac(p.u, exp, secret), 'hex');
  const recu = Buffer.from(p.sig, 'hex');
  return attendu.length === recu.length && timingSafeEqual(attendu, recu) ? p.u : null;
}
