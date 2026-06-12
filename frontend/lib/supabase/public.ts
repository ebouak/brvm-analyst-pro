// Client Supabase anonyme SANS cookies — pour les pages publiques ISR/statiques
// (sitemap, /societes, /simulateur, /brief). N'utilise jamais la session :
// uniquement les tables en lecture publique (RLS using(true)).
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
