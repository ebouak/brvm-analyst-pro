/**
 * Image de la récap d'un utilisateur pour l'e-mail du soir (brief-envoi.mjs),
 * obtenue auprès du site par un LIEN SIGNÉ (spec 2026-10-24-recap-portefeuille).
 *
 * COPIE CONFORME de la signature de frontend/lib/recap/signature.ts et de
 * scraper/src/recap/telecharger.ts (paquets distincts) : toute correction est
 * à reporter des trois côtés.
 *
 * null si la récap n'existe pas (portefeuille vide) ou si le site ne répond
 * pas : l'e-mail part alors sans pièce jointe, jamais pas du tout.
 */
import { createHmac } from 'node:crypto';

export function signerRecap(userId, secret, maintenantS = Math.floor(Date.now() / 1000), dureeS = 300) {
  const exp = maintenantS + Math.min(dureeS, 600);
  return { u: userId, exp, sig: createHmac('sha256', secret).update(`${userId}.${exp}`).digest('hex') };
}

export async function telechargerRecap(userId, { secret, site = 'https://www.westbourse.com' } = {}) {
  if (!secret || secret.length < 32 || !userId) return null;
  const s = signerRecap(userId, secret);
  try {
    const r = await fetch(`${site.replace(/\/+$/, '')}/api/recap/image?u=${s.u}&exp=${s.exp}&sig=${s.sig}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}
