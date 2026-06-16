import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface SubscriptionRow {
  id: string;
  user_email: string | null;
  plan_name: string | null;
  status: string;
  billing_cycle: string;
  started_at: string | null;
  renews_at: string | null;
}

export interface SubscriptionsDashboard {
  subscriptions: SubscriptionRow[];
  kpis: { total: number; active: number; pastDue: number };
}

/** Charge les abonnements récents (plan joint, email enrichi) + KPIs. Tolérant. */
export async function loadSubscriptions(limit = 100): Promise<SubscriptionsDashboard> {
  const db = getAdminClient();
  const { data } = await db
    .from('subscriptions')
    .select('id, user_id, status, billing_cycle, started_at, renews_at, subscription_plans(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Record<string, unknown>[];

  // Enrichissement email : pas de FK subscriptions→profiles, on mappe via une requête séparée.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id as string).filter(Boolean)));
  const emailById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profs } = await db.from('profiles').select('id, email').in('id', userIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) emailById.set(p.id, p.email);
  }

  const subscriptions: SubscriptionRow[] = rows.map((r) => {
    const planRaw = r.subscription_plans as { name?: string } | { name?: string }[] | null;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    return {
      id: r.id as string,
      user_email: emailById.get(r.user_id as string) ?? null,
      plan_name: plan?.name ?? null,
      status: r.status as string,
      billing_cycle: r.billing_cycle as string,
      started_at: (r.started_at as string) ?? null,
      renews_at: (r.renews_at as string) ?? null,
    };
  });

  const active = subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing').length;
  const pastDue = subscriptions.filter((s) => s.status === 'past_due').length;
  return { subscriptions, kpis: { total: subscriptions.length, active, pastDue } };
}
