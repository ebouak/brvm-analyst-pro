import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface PaymentRow {
  id: string;
  subscription_id: string | null;
  user_email: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export interface PaymentsDashboard {
  payments: PaymentRow[];
  kpis: { total: number; paid: number; failed: number; paidAmount: number; currency: string };
}

/** Charge les transactions récentes (email enrichi) + KPIs. Tolérant. */
export async function loadPayments(limit = 100): Promise<PaymentsDashboard> {
  const db = getAdminClient();
  const { data } = await db
    .from('billing_transactions')
    .select('id, subscription_id, user_id, provider, amount, currency, status, payment_method, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Record<string, unknown>[];

  // Enrichissement email : pas de FK billing_transactions→profiles, on mappe via une requête séparée.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id as string).filter(Boolean)));
  const emailById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profs } = await db.from('profiles').select('id, email').in('id', userIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) emailById.set(p.id, p.email);
  }

  const payments: PaymentRow[] = rows.map((r) => ({
    id: r.id as string,
    subscription_id: (r.subscription_id as string) ?? null,
    user_email: emailById.get(r.user_id as string) ?? null,
    provider: r.provider as string,
    amount: Number(r.amount ?? 0),
    currency: (r.currency as string) ?? 'XOF',
    status: r.status as string,
    payment_method: (r.payment_method as string) ?? null,
    paid_at: (r.paid_at as string) ?? null,
    created_at: (r.created_at as string) ?? null,
  }));

  const paid = payments.filter((p) => p.status === 'paid');
  const failed = payments.filter((p) => p.status === 'failed').length;
  const paidAmount = paid.reduce((acc, p) => acc + p.amount, 0);
  const currency = payments[0]?.currency ?? 'XOF';
  return { payments, kpis: { total: payments.length, paid: paid.length, failed, paidAmount, currency } };
}
