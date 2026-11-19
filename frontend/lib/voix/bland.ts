import 'server-only';
import type { ParametresAppel } from './script';
import type { DetailBland } from './statut';

/**
 * Client MINCE de l'API Bland (pas de SDK). Clé : BLAND_API_KEY, serveur seul,
 * en-tête `authorization` SANS « Bearer » (vérifié le 2026-11-19).
 * Jamais de réessai ici : un appel relancé à tort sonne deux fois chez quelqu'un.
 */
const BASE = 'https://api.bland.ai/v1';
const DELAI_MS = 15_000;

export type ResultatLancement =
  | { ok: true; callId: string }
  /** `incertain` : l'appel a pu partir (délai dépassé, 5xx) — jamais de nouvel essai automatique. */
  | { ok: false; incertain: boolean; erreur: string };

function cle(): string | null {
  const k = process.env.BLAND_API_KEY;
  return k && k.length > 10 ? k : null;
}

export function blandConfigure(): boolean {
  return cle() !== null;
}

export async function lancerAppelBland(numero: string, p: ParametresAppel): Promise<ResultatLancement> {
  const k = cle();
  if (!k) return { ok: false, incertain: false, erreur: 'BLAND_API_KEY absente' };
  let r: Response;
  try {
    r = await fetch(`${BASE}/calls`, {
      method: 'POST',
      headers: { authorization: k, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: numero, ...p }),
      signal: AbortSignal.timeout(DELAI_MS),
      cache: 'no-store',
    });
  } catch (e) {
    // Délai dépassé ou réseau coupé APRÈS l'envoi : Bland a pu accepter l'appel.
    return { ok: false, incertain: true, erreur: (e as Error).name === 'TimeoutError' ? 'délai dépassé' : 'réseau' };
  }
  const corps = (await r.json().catch(() => null)) as { call_id?: string; status?: string; message?: string } | null;
  if (r.ok && corps?.call_id) return { ok: true, callId: String(corps.call_id) };
  // Le corps n'est pas relayé tel quel : il pourrait citer le numéro.
  return { ok: false, incertain: r.status >= 500 || (r.ok && !corps?.call_id), erreur: `HTTP ${r.status}` };
}

export async function lireAppelBland(callId: string): Promise<{ ok: true; detail: DetailBland } | { ok: false; erreur: string }> {
  const k = cle();
  if (!k) return { ok: false, erreur: 'BLAND_API_KEY absente' };
  if (!/^[A-Za-z0-9-]{8,80}$/.test(callId)) return { ok: false, erreur: 'identifiant d’appel invalide' };
  try {
    const r = await fetch(`${BASE}/calls/${encodeURIComponent(callId)}`, {
      headers: { authorization: k },
      signal: AbortSignal.timeout(DELAI_MS),
      cache: 'no-store',
    });
    if (!r.ok) return { ok: false, erreur: `HTTP ${r.status}` };
    return { ok: true, detail: (await r.json()) as DetailBland };
  } catch (e) {
    return { ok: false, erreur: (e as Error).name === 'TimeoutError' ? 'délai dépassé' : 'réseau' };
  }
}
