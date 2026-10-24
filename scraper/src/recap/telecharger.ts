/**
 * Image de la récap d'un utilisateur, récupérée auprès du site par un LIEN
 * SIGNÉ (spec docs/superpowers/specs/2026-10-24-recap-portefeuille-design.md).
 *
 * Le rendu vit côté site (frontend/lib/recap/rendu.tsx) : une seule mise en
 * page, celle que voit l'utilisateur sur /portefeuille. Le worker n'a pas de
 * session, d'où la signature HMAC (RECAP_SECRET, 5 minutes).
 *
 * `signerRecap` est une COPIE CONFORME de frontend/lib/recap/signature.ts
 * (paquets distincts) : toute correction est à reporter des trois côtés
 * (frontend, scraper, video/recapSignature.mjs).
 *
 * Renvoie null si la récap n'existe pas (portefeuille vide → 404) ou si le
 * site ne répond pas : le point du soir part alors sans image, jamais l'inverse.
 */
import { createHmac } from 'node:crypto';

export function signerRecap(userId: string, secret: string, maintenantS = Math.floor(Date.now() / 1000), dureeS = 300) {
  const exp = maintenantS + Math.min(dureeS, 600);
  return { u: userId, exp, sig: createHmac('sha256', secret).update(`${userId}.${exp}`).digest('hex') };
}

export function recapConfiguree(): boolean {
  return (process.env.RECAP_SECRET ?? '').length >= 32;
}

export async function telechargerRecap(userId: string): Promise<Buffer | null> {
  const secret = process.env.RECAP_SECRET;
  if (!secret || secret.length < 32) return null;
  const site = (process.env.SITE_URL || 'https://www.westbourse.com').replace(/\/+$/, '');
  const s = signerRecap(userId, secret);
  try {
    const r = await fetch(`${site}/api/recap/image?u=${s.u}&exp=${s.exp}&sig=${s.sig}`, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}
