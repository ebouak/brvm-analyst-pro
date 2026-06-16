import { getServiceClient } from '@/lib/billing/serviceClient';

export interface NewsletterRow {
  id: string;
  email: string;
  confirmed: boolean;
  source: string;
  subscribed_at: string | null;
  confirmed_at: string | null;
}

export interface NewsletterDashboard {
  subscribers: NewsletterRow[];
  kpis: { total: number; confirmed: number; rate: number | null };
}

/** Liste des abonnés (filtre email optionnel) + KPIs. */
export async function loadNewsletter(search?: string): Promise<NewsletterDashboard> {
  const db = getServiceClient();
  let query = db
    .from('newsletter_subscribers')
    .select('id, email, confirmed, source, subscribed_at, confirmed_at')
    .order('subscribed_at', { ascending: false })
    .limit(200);
  if (search && search.trim()) query = query.ilike('email', `%${search.trim()}%`);
  const [listRes, totalRes, confirmedRes] = await Promise.all([
    query,
    db.from('newsletter_subscribers').select('*', { count: 'exact', head: true }),
    db.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('confirmed', true),
  ]);
  const subscribers = (listRes.data ?? []) as NewsletterRow[];
  const total = totalRes.count ?? 0;
  const confirmed = confirmedRes.count ?? 0;
  return { subscribers, kpis: { total, confirmed, rate: total > 0 ? confirmed / total : null } };
}
