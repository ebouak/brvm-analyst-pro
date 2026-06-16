import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase service-role (bypass RLS) — SERVER-ONLY.
 * Ne JAMAIS importer depuis un composant client. Repli sur la clé anon si la
 * service_role est absente (lecture publique limitée), pour ne pas crasher en dev.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
