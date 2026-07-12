import { NextResponse } from 'next/server';
import { authenticateApiRequest, type ApiClient } from '@/lib/api/auth';

/**
 * API publique BRVM — désormais SUR AUTORISATION (audit sécurité 2026-07-13).
 *
 * Avant : ouverte à tous, CORS `*`, rate-limit dans une Map mémoire. Sur Vercel
 * serverless chaque instance avait sa propre Map → le quota ne tenait pas, et
 * n'importe qui pouvait aspirer toute la base BRVM.
 *
 * Maintenant : clé obligatoire (`x-api-key`), vérifiée par hash, quota compté
 * en base. Le CORS `*` reste (une clé n'est pas un secret de navigateur : elle
 * s'utilise côté serveur), mais la réponse n'est JAMAIS mise en cache partagé —
 * sinon le CDN resservirait des données sans revérifier la clé ni le quota.
 */

interface JsonOpts {
  status?: number;
  /** Réponse authentifiée : interdit tout cache partagé (CDN). */
  authenticated?: boolean;
}

export function apiJson(data: unknown, opts: JsonOpts | number = {}) {
  const { status = 200, authenticated = true } =
    typeof opts === 'number' ? { status: opts, authenticated: true } : opts;

  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'x-api-key, authorization, content-type',
      // Le CDN ne doit pas resservir une réponse sans revérifier la clé/le quota.
      'Cache-Control': authenticated
        ? 'private, no-store'
        : 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export function apiError(message: string, status = 400) {
  return apiJson({ error: message }, { status, authenticated: true });
}

/**
 * Garde d'entrée des routes `/api/public/v1/*`.
 * Renvoie soit le client authentifié, soit la réponse d'erreur à retourner tel
 * quel (401 clé manquante/invalide, 403 non actif, 429 quota dépassé).
 */
export async function requireApiClient(
  req: Request,
): Promise<{ client: ApiClient } | { response: NextResponse }> {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) {
    const res = apiError(auth.error, auth.status);
    if (auth.status === 401) {
      // Indique le schéma attendu (bonne pratique HTTP).
      res.headers.set('WWW-Authenticate', 'Bearer realm="WESTBOURSE API"');
    }
    return { response: res };
  }
  return { client: auth.client };
}

/** Pré-vol CORS : autorise l'en-tête `x-api-key`. */
export function apiOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'x-api-key, authorization, content-type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
