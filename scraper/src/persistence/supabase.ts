/**
 * Client Supabase côté serveur (service_role).
 * ATTENTION : la clé service_role bypass la RLS. Elle ne doit JAMAIS être
 * exposée au frontend ni commitée (cf. §6.6). Le scraper est un worker
 * backend de confiance.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config.js';

// ws requis par Supabase Realtime sur Node < 22 (pas de WebSocket natif)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wsLib: any;
try {
  const mod = await import('ws');
  wsLib = mod.default ?? mod;
} catch {
  // Node 22+ a WebSocket natif — pas de fallback nécessaire
}

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
    ...(wsLib ? { realtime: { transport: wsLib } } : {}),
  });
  return cached;
}
