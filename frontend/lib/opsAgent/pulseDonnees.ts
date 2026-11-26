import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkflowDotStatus = 'ok' | 'warn' | 'ko' | 'off';

export interface PulseData {
  observeAUtc: string;
  totalUsers: number;
  newUsers7d: number;
  premiumUsers: number;
  conversionPct: number;
  pendingPayments: number;
  unreadContacts: number;
  openIncidents: number;
  openAgregats: number;
  derniereSeance: string | null;
  valeursCotees: number;
  scraperOk24h: number;
  scraperKo24h: number;
  workflowDots: Array<{ nom: string; status: WorkflowDotStatus }>;
}

async function safeCount(fn: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await fn();
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function chargerPulseData(db: SupabaseClient): Promise<PulseData> {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const since24h = new Date(now.getTime() - 86_400_000).toISOString();

  const [
    totalUsers,
    newUsers7d,
    premiumUsers,
    pendingPayments,
    unreadContacts,
    openIncidents,
    openAgregats,
    scraperOk24h,
    scraperKo24h,
    seanceRes,
    workflowsRes,
  ] = await Promise.all([
    safeCount(() => db.from('profiles').select('*', { count: 'exact', head: true })),
    safeCount(() => db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since7d)),
    safeCount(() => db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true)),
    safeCount(() => db.from('billing_transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(() => db.from('contact_messages').select('*', { count: 'exact', head: true }).eq('statut', 'nouveau')),
    safeCount(() => db.from('ops_incidents').select('*', { count: 'exact', head: true }).eq('statut', 'ouvert')),
    safeCount(() => db.from('indicateur_relecture').select('*', { count: 'exact', head: true }).eq('statut', 'ouverte')),
    safeCount(() =>
      db.from('scraper_runs').select('*', { count: 'exact', head: true }).eq('status', 'success').gte('started_at', since24h),
    ),
    safeCount(() =>
      db.from('scraper_runs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('started_at', since24h),
    ),
    db.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle(),
    db
      .from('ops_workflows')
      .select('fichier, etat, derniere_conclusion, echecs_consecutifs')
      .neq('etat', 'deleted')
      .order('fichier')
      .limit(45),
  ]);

  const derniereSeance = (seanceRes.data?.date_marche as string | undefined) ?? null;
  const valeursCotees = derniereSeance
    ? await safeCount(() =>
        db.from('brvm_actions_daily').select('*', { count: 'exact', head: true }).eq('date_marche', derniereSeance),
      )
    : 0;

  const workflowDots = ((workflowsRes.data ?? []) as Array<{
    fichier: string;
    etat: string;
    derniere_conclusion: string | null;
    echecs_consecutifs: number;
  }>).map((w) => {
    let status: WorkflowDotStatus = 'ok';
    if (w.etat !== 'active') status = 'off';
    else if (w.echecs_consecutifs >= 2 || w.derniere_conclusion === 'failure') status = 'ko';
    else if (w.echecs_consecutifs === 1 || w.derniere_conclusion === 'cancelled') status = 'warn';
    return { nom: w.fichier.replace('.yml', ''), status };
  });

  const conversionPct = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 1000) / 10 : 0;

  return {
    observeAUtc: now.toISOString().slice(11, 16) + ' UTC',
    totalUsers,
    newUsers7d,
    premiumUsers,
    conversionPct,
    pendingPayments,
    unreadContacts,
    openIncidents,
    openAgregats,
    derniereSeance,
    valeursCotees,
    scraperOk24h,
    scraperKo24h,
    workflowDots,
  };
}
