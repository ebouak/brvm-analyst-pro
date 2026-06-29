import { getServiceClient } from '@/lib/billing/serviceClient';

export interface WeeklyReport {
  id: string;
  slug: string;
  titre: string;
  resume: string | null;
  date_publication: string;
  status: 'draft' | 'published';
  metadata: Record<string, unknown> | null;
  ticker_codes: string[] | null;
  content_html: string | null;
}

export async function listWeeklyReports(): Promise<WeeklyReport[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('brvm_news')
    .select('id, slug, titre, resume, date_publication, status, metadata, ticker_codes')
    .like('slug', 'westbourse-commodities-weekly-%')
    .order('date_publication', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as WeeklyReport[];
}

export async function getWeeklyReport(id: string): Promise<WeeklyReport | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('brvm_news')
    .select('id, slug, titre, resume, date_publication, status, metadata, ticker_codes, content_html')
    .eq('id', id)
    .like('slug', 'westbourse-commodities-weekly-%')
    .single();
  if (error) return null;
  return data as WeeklyReport;
}

export async function updateWeeklyReport(
  id: string,
  patch: { titre?: string; resume?: string; status?: 'draft' | 'published' },
): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from('brvm_news').update(patch).eq('id', id);
  if (error) throw error;
}
