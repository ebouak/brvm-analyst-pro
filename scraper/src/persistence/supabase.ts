/**
 * Client Supabase côté serveur (service_role).
 * ATTENTION : la clé service_role bypass la RLS. Elle ne doit JAMAIS être
 * exposée au frontend ni commitée (cf. §6.6). Le scraper est un worker
 * backend de confiance.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ws } from '../polyfills.js';
import { getConfig } from '../config.js';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants. ' +
        'Requis pour écrire en base (ou utilisez DRY_RUN=true).',
    );
  }
  cached = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as never },
  });
  return cached;
}
