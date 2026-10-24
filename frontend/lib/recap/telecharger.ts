import 'server-only';
import { signerRecap } from './signature';

/**
 * Récupère l'image de la récap auprès de la route Edge /api/recap/image, par
 * lien signé (RECAP_SECRET, 5 min). Utilisé par les webhooks RECAP (runtime
 * Node) : l'image n'est rendue qu'à un seul endroit, la route Edge.
 *
 * Distingue « portefeuille vide » (404 — réponse normale à l'utilisateur) de
 * « panne » (secret absent, site muet, réponse inattendue) : annoncer un
 * portefeuille vide à quelqu'un qui en a un serait une information fausse.
 */
export type ResultatRecap = { etat: 'ok'; png: Buffer } | { etat: 'vide' } | { etat: 'panne' };

export async function telechargerRecap(userId: string, origine: string): Promise<ResultatRecap> {
  const secret = process.env.RECAP_SECRET;
  if (!secret || secret.length < 32) return { etat: 'panne' };
  const s = await signerRecap(userId, secret);
  try {
    const r = await fetch(`${origine.replace(/\/+$/, '')}/api/recap/image?u=${s.u}&exp=${s.exp}&sig=${s.sig}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (r.status === 404) return { etat: 'vide' };
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return { etat: 'panne' };
    return { etat: 'ok', png: Buffer.from(await r.arrayBuffer()) };
  } catch {
    return { etat: 'panne' };
  }
}
