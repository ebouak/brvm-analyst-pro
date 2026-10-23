/**
 * Surveillance de la passerelle WhatsApp non officielle (WAHA, serveur
 * westbourse-wa). Spec : docs/superpowers/specs/2026-10-23-whatsapp-passerelle-design.md §5.
 *
 * Pourquoi un passage planifié en plus de l'alerte par webhook : quand WAHA
 * lui-même est arrêté (conteneur tombé, serveur éteint), il n'envoie plus aucun
 * webhook — le silence ressemblerait à « tout va bien ». Quatre pannes
 * silencieuses ont déjà coûté cher à ce projet.
 *
 * Le message d'alerte ne contient ni numéro ni identifiant de compte.
 */
import { sendTelegramText } from '../alerts/channels.js';

const DELAI_MS = 10_000;
const SAINS = new Set(['WORKING', 'STARTING']);

export interface ObservationSession {
  joignable: boolean;
  statut: string | null;
}

export function evaluerSessionWhatsapp(o: ObservationSession): { niveau: 'ok' | 'panne'; message: string } {
  if (!o.joignable) {
    return { niveau: 'panne', message: 'passerelle injoignable : serveur westbourse-wa, WAHA ou Caddy arrêté, ou réseau coupé.' };
  }
  if (o.statut && SAINS.has(o.statut)) return { niveau: 'ok', message: `session ${o.statut}` };
  return {
    niveau: 'panne',
    message: `session au statut ${o.statut ?? 'inconnu'} : déconnexion, bannissement ou association perdue. Relancer l'association (session.sh relancer puis QR).`,
  };
}

async function observer(): Promise<ObservationSession> {
  const url = process.env.WAHA_URL?.replace(/\/+$/, '');
  const cle = process.env.WAHA_API_KEY;
  const session = process.env.WAHA_SESSION || 'default';
  if (!url || !cle) throw new Error('WAHA_URL ou WAHA_API_KEY absent : surveillance impossible (secret GitHub manquant ?)');
  try {
    const r = await fetch(`${url}/api/sessions/${encodeURIComponent(session)}`, {
      headers: { 'X-Api-Key': cle },
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (r.status === 401) throw new Error('WAHA refuse la clé d’API (401) : secret GitHub WAHA_API_KEY périmé ?');
    if (r.status === 404) return { joignable: true, statut: 'ABSENTE' };
    if (!r.ok) return { joignable: false, statut: null };
    const d = (await r.json()) as { status?: string };
    return { joignable: true, statut: d.status ?? null };
  } catch (e) {
    if (e instanceof Error && /clé d’API/.test(e.message)) throw e;
    return { joignable: false, statut: null };
  }
}

export async function runSanteWhatsapp(opts: { mock: boolean }): Promise<{ niveau: 'ok' | 'panne'; message: string; alerteEnvoyee: boolean }> {
  const obs = opts.mock ? { joignable: true, statut: 'WORKING' } : await observer();
  const verdict = evaluerSessionWhatsapp(obs);
  if (verdict.niveau === 'ok' || opts.mock) return { ...verdict, alerteEnvoyee: false };

  const res = await sendTelegramText({ subject: '📵 WhatsApp — passerelle en panne', body: verdict.message, operateur: true });
  return { ...verdict, alerteEnvoyee: !!res && res.status === 'sent' };
}
