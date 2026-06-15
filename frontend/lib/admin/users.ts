import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/** Client service-role en lecture seule (bypass RLS) — server-only. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  is_premium: boolean;
  premium_since: string | null;
  profil: string | null;
  onboarding_done: boolean;
  created_at: string | null;
}

export interface UsersDashboard {
  users: AdminUserRow[];
  kpis: { total: number; premium: number; onboarded: number };
}

/** Charge les derniers profils + KPIs (lecture seule, tolérant). */
export async function loadUsers(limit = 100): Promise<UsersDashboard> {
  const db = getAdminClient();
  const [listRes, totalRes, premiumRes, onboardedRes] = await Promise.all([
    db
      .from('profiles')
      .select('id, email, is_premium, premium_since, profil, onboarding_done, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_done', true),
  ]);
  const users = (listRes.data ?? []) as AdminUserRow[];
  return {
    users,
    kpis: {
      total: totalRes.count ?? 0,
      premium: premiumRes.count ?? 0,
      onboarded: onboardedRes.count ?? 0,
    },
  };
}
