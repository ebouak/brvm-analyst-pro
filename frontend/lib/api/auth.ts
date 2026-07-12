import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { hashKey, isWellFormedKey } from './keys';

/**
 * Authentification de l'API publique (`/api/public/v1/*`).
 *
 * Remplace l'ancien modèle « ouvert à tous » : la clé est obligatoire, vérifiée
 * par comparaison de HASH (la base ne contient jamais la clé en clair), et le
 * quota est compté EN BASE — l'ancien rate-limit vivait dans une Map mémoire,
 * donc chaque instance serverless avait la sienne et le quota ne tenait pas.
 */

export interface ApiClient {
  id: string;
  nom: string;
  quota_daily: number;
}

export type AuthFailure =
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 403; error: string }
  | { ok: false; status: 429; error: string };

export type AuthResult = { ok: true; client: ApiClient; used: number } | AuthFailure;

/** Extrait la clé de `x-api-key` ou d'un `Authorization: Bearer …`. */
export function extractKey(req: Request): string | null {
  const header = req.headers.get('x-api-key');
  if (header) return header.trim();
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

/**
 * Authentifie la requête et consomme une unité de quota.
 * Renvoie le client si tout est bon, sinon l'erreur HTTP à retourner.
 */
export async function authenticateApiRequest(req: Request): Promise<AuthResult> {
  const key = extractKey(req);

  if (!isWellFormedKey(key)) {
    return {
      ok: false,
      status: 401,
      error:
        "Clé d'API requise. Demandez un accès sur /developers (en-tête `x-api-key`).",
    };
  }

  const db = getServiceClient();

  // Vérification par HASH : la clé en clair n'existe nulle part en base.
  const { data, error } = await db
    .from('api_clients')
    .select('id, nom, statut, quota_daily')
    .eq('key_hash', hashKey(key as string))
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 401, error: "Clé d'API invalide." };
  }

  const client = data as ApiClient & { statut: string };

  if (client.statut !== 'active') {
    return {
      ok: false,
      status: 403,
      error:
        client.statut === 'revoked'
          ? "Clé révoquée. Contactez-nous si vous pensez qu'il s'agit d'une erreur."
          : "Accès non actif. Votre demande est en cours d'examen.",
    };
  }

  // Quota journalier — incrément ATOMIQUE côté base (deux requêtes simultanées
  // ne peuvent pas écraser mutuellement le compteur).
  const { data: used, error: usageErr } = await db.rpc('api_usage_increment', {
    p_client_id: client.id,
  });

  if (usageErr) {
    // On ne bloque pas le service pour un incident de comptage, mais on le trace.
    console.error('api_usage_increment a échoué :', usageErr.message);
    return { ok: true, client, used: 0 };
  }

  const count = typeof used === 'number' ? used : 0;
  if (count > client.quota_daily) {
    return {
      ok: false,
      status: 429,
      error: `Quota journalier dépassé (${client.quota_daily} requêtes/jour). Il se réinitialise à minuit UTC.`,
    };
  }

  // Dernier usage (best-effort : n'échoue jamais la requête).
  void db.from('api_clients').update({ last_used_at: new Date().toISOString() }).eq('id', client.id);

  return { ok: true, client, used: count };
}
