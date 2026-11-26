import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

export interface AdminBadge {
  count: number;
  tone: 'critical' | 'warning' | 'info';
}

async function safeCount(fn: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await fn();
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Compteurs temps réel affichés dans la sidebar d'administration.
 * Chaque requête est tolérante : une table pas encore migrée renvoie 0.
 */
export async function loadAdminBadges(): Promise<Record<string, AdminBadge>> {
  const db = getServiceClient();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [
    paymentsPending,
    contactsNew,
    agregatsOpen,
    apiPending,
    forumReports,
    coherenceTrompeuse,
    scrapeFailed,
    disabledWorkflows,
    opsIncidents,
    tiktokAValider,
  ] = await Promise.all([
    safeCount(() => db.from('billing_transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(() => db.from('contact_messages').select('*', { count: 'exact', head: true }).eq('statut', 'nouveau')),
    safeCount(() => db.from('indicateur_relecture').select('*', { count: 'exact', head: true }).eq('statut', 'ouverte')),
    safeCount(() => db.from('api_clients').select('*', { count: 'exact', head: true }).eq('statut', 'pending')),
    safeCount(() => db.from('forum_reports').select('*', { count: 'exact', head: true }).eq('resolved', false)),
    safeCount(() =>
      db
        .from('coherence_anomalies')
        .select('*', { count: 'exact', head: true })
        .is('resolue_le', null)
        .eq('gravite', 'trompeuse'),
    ),
    safeCount(() =>
      db
        .from('scraper_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('started_at', since24h),
    ),
    safeCount(() =>
      db
        .from('ops_workflows')
        .select('*', { count: 'exact', head: true })
        .in('etat', ['disabled_inactivity', 'disabled_manually']),
    ),
    safeCount(() => db.from('ops_incidents').select('*', { count: 'exact', head: true }).eq('statut', 'ouvert')),
    safeCount(() =>
      db
        .from('publications_sociales')
        .select('*', { count: 'exact', head: true })
        .eq('reseau', 'tiktok')
        .eq('statut', 'a_valider'),
    ),
  ]);

  const out: Record<string, AdminBadge> = {};
  const put = (href: string, count: number, tone: AdminBadge['tone']) => {
    if (count > 0) out[href] = { count, tone };
  };

  put('/admin/payments', paymentsPending, 'warning');
  put('/admin/contact', contactsNew, 'warning');
  put('/admin/agregats', agregatsOpen, 'info');
  put('/admin/api-clients', apiPending, 'warning');
  put('/admin/forum', forumReports, 'warning');
  put('/admin/coherence', coherenceTrompeuse, 'critical');
  put('/admin/controle', scrapeFailed + disabledWorkflows, 'critical');
  put('/admin/ops', opsIncidents, 'critical');
  put('/admin/reseaux/tiktok', tiktokAValider, 'info');

  return out;
}
