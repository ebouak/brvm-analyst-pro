import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase service-role (bypass RLS) — SERVER-ONLY.
 * Ne JAMAIS importer depuis un composant client.
 *
 * Échec explicite si la clé service-role manque : tous les appelants écrivent/lisent
 * des tables `service_role`-only (admin, billing, audit). Un repli silencieux vers
 * la clé anon ferait échouer ces opérations sous RLS *sans erreur* (écritures
 * perdues, audit muet). Mieux vaut lever tout de suite que dégrader en silence.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'getServiceClient: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (clé service-role absente côté serveur).',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
