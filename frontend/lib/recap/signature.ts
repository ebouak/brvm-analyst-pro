/**
 * Lien signé de la récap : permet aux envois (point du soir, commande RECAP)
 * d'obtenir l'image d'UN utilisateur sans session, pendant quelques minutes.
 *
 * Signature HMAC-SHA256 hexadécimale de `u.exp` avec RECAP_SECRET (Vercel +
 * GitHub). Web Crypto et non `node:crypto` : la route de l'image tourne en
 * runtime Edge, comme toutes les images du site (next/og).
 * Durée de vie bornée à DUREE_MAX_S, même si l'appelant demande plus.
 *
 * Même résultat, au caractère près, que les copies node:crypto de
 * scraper/src/recap/telecharger.ts et video/recapSignature.mjs (paquets
 * distincts) : toute correction est à reporter des trois côtés.
 */
export const DUREE_MAX_S = 600;

const enc = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const cle = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cle, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant (pas de timingSafeEqual en Edge). */
function egaux(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signerRecap(userId: string, secret: string, maintenantS = Math.floor(Date.now() / 1000), dureeS = 300) {
  const exp = maintenantS + Math.min(dureeS, DUREE_MAX_S);
  return { u: userId, exp, sig: await hmacHex(`${userId}.${exp}`, secret) };
}

export async function verifierRecap(
  p: { u: string | null; exp: string | null; sig: string | null },
  secret: string | undefined,
  maintenantS = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  // Secret absent ou trop court : la voie signée est fermée, jamais ouverte par défaut.
  if (!secret || secret.length < 32 || !p.u || !p.exp || !p.sig) return null;
  const exp = Number(p.exp);
  if (!Number.isInteger(exp) || exp < maintenantS || exp > maintenantS + DUREE_MAX_S) return null;
  if (!/^[0-9a-f-]{36}$/i.test(p.u) || !/^[0-9a-f]{64}$/.test(p.sig)) return null;
  return egaux(await hmacHex(`${p.u}.${exp}`, secret), p.sig) ? p.u : null;
}
