import 'server-only';
import type { VenteChariow } from './regles';

/**
 * Client HTTP Chariow — SERVEUR UNIQUEMENT (`server-only` fait échouer le build
 * si un composant client l'importe). La clé ne quitte jamais ce module : elle
 * n'apparaît ni dans les erreurs, ni dans les journaux.
 *
 * API : https://chariow.dev — enveloppe `{ message, data, errors }`,
 * authentification `Authorization: Bearer sk_…`, 100 requêtes/minute.
 */

const BASE_DEFAUT = 'https://api.chariow.com/v1';

export class ErreurChariow extends Error {
  constructor(
    message: string,
    readonly statut: number,
    /** Vrai = réessayer a un sens (429, 5xx, réseau). */
    readonly transitoire: boolean,
  ) {
    super(message);
    this.name = 'ErreurChariow';
  }
}

/** Lu à l'appel, jamais au chargement du module (le build n'a pas les secrets). */
export function chariowConfigure(): boolean {
  return Boolean(process.env.CHARIOW_API_KEY);
}

async function appeler<T>(chemin: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const cle = process.env.CHARIOW_API_KEY;
  if (!cle) throw new ErreurChariow('Chariow non configuré', 0, false);
  const base = (process.env.CHARIOW_API_BASE_URL || BASE_DEFAUT).replace(/\/+$/, '');

  let resp: Response;
  try {
    resp = await fetch(`${base}${chemin}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${cle}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        // User-Agent explicite : certaines API refusent une clé secrète derrière
        // un UA de navigateur (vu chez Supabase, voir CLAUDE.md).
        'User-Agent': 'westbourse-server/1.0',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new ErreurChariow(`réseau : ${(e as Error).name}`, 0, true);
  }

  let json: { message?: string; data?: unknown } = {};
  try {
    json = (await resp.json()) as typeof json;
  } catch {
    /* corps vide ou non-JSON : le statut HTTP suffit */
  }

  if (!resp.ok) {
    // Seul le message de Chariow est gardé (jamais d'en-tête, jamais la clé).
    const msg = String(json.message ?? `HTTP ${resp.status}`).slice(0, 200);
    throw new ErreurChariow(msg, resp.status, resp.status === 429 || resp.status >= 500);
  }
  return json.data as T;
}

export interface InitCheckout {
  product_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: { number: string; country_code: string };
  redirect_url: string;
  custom_metadata: Record<string, string>;
  customer_ip?: string;
}

export interface ReponseCheckout {
  step: 'payment' | 'completed' | 'already_purchased';
  message: string | null;
  purchase: { id: string; status: string } | null;
  payment: { checkout_url: string | null; transaction_id: string | null } | null;
}

/** POST /v1/checkout */
export function initierCheckout(corps: InitCheckout): Promise<ReponseCheckout> {
  return appeler<ReponseCheckout>('/checkout', { method: 'POST', body: corps });
}

/** GET /v1/sales/{id} — la seule source de vérité sur une vente. */
export function lireVente(saleId: string): Promise<VenteChariow> {
  if (!/^sal_[A-Za-z0-9]{3,100}$/.test(saleId)) {
    return Promise.reject(new ErreurChariow('identifiant de vente invalide', 400, false));
  }
  return appeler<VenteChariow>(`/sales/${encodeURIComponent(saleId)}`, { method: 'GET' });
}
