import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadCronHealth, isBroken } from './cronHealth';
import { isTestSender } from '@/lib/server/email';

/**
 * « Ce qui demande votre attention » — le cœur du poste de pilotage.
 *
 * Une vue d'ensemble qui n'affiche que des compteurs est un rapport, pas un
 * poste de pilotage : elle dit que tout va bien sans dire ce qu'il faut FAIRE.
 * Ce module remonte les seuls éléments qui appellent une décision, chacun avec
 * le lien qui permet d'agir.
 */

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  level: AlertLevel;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

/**
 * Comptage tolérant : une table pas encore migrée (ex. auth_events avant 0092)
 * ne doit pas faire tomber le poste de pilotage.
 * `PromiseLike` : le builder PostgREST est « thenable », pas une vraie Promise.
 */
async function safeCount(fn: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await fn();
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadAttention(): Promise<AttentionItem[]> {
  const db = getServiceClient();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const items: AttentionItem[] = [];

  const [
    apiPending,
    paymentsPending,
    scrapeFailed,
    criticalAudit,
    failedLogins,
    disabledFeatures,
    cronJobs,
    opsIncidentsOpen,
    disabledWorkflows,
    coherenceTrompeuses,
    contactsNew,
    agregatsOpen,
  ] = await Promise.all([
    safeCount(() =>
      db.from('api_clients').select('*', { count: 'exact', head: true }).eq('statut', 'pending'),
    ),
    safeCount(() =>
      db
        .from('billing_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
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
        .from('admin_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .gte('created_at', since24h),
    ),
    safeCount(() =>
      db
        .from('auth_events')
        .select('*', { count: 'exact', head: true })
        .eq('event', 'sign_in_failed')
        .gte('created_at', since24h),
    ),
    safeCount(() =>
      db.from('feature_flags').select('*', { count: 'exact', head: true }).eq('acces', 'disabled'),
    ),
    loadCronHealth(),
    safeCount(() =>
      db.from('ops_incidents').select('*', { count: 'exact', head: true }).eq('statut', 'ouvert'),
    ),
    safeCount(() =>
      db
        .from('ops_workflows')
        .select('*', { count: 'exact', head: true })
        .in('etat', ['disabled_inactivity', 'disabled_manually']),
    ),
    safeCount(() =>
      db
        .from('coherence_anomalies')
        .select('*', { count: 'exact', head: true })
        .is('resolue_le', null)
        .eq('gravite', 'trompeuse'),
    ),
    safeCount(() =>
      db.from('contact_messages').select('*', { count: 'exact', head: true }).eq('statut', 'nouveau'),
    ),
    safeCount(() =>
      db.from('indicateur_relecture').select('*', { count: 'exact', head: true }).eq('statut', 'ouverte'),
    ),
  ]);

  // Expéditeur encore en adresse de test : tout email vers un TIERS (demandeur de
  // clé API, abonné newsletter) est refusé en 403 par Resend. L'échec est
  // silencieux côté utilisateur — d'où cette alerte, sinon on ne le découvre qu'en
  // ratant une livraison de clé.
  if (isTestSender()) {
    items.push({
      level: 'critical',
      title: 'Emails vers l’extérieur impossibles',
      detail:
        'L’expéditeur est encore l’adresse de test Resend : elle n’écrit qu’à vous. Vérifiez westbourse.com sur resend.com/domains, puis posez ALERTS_EMAIL_FROM.',
      href: '/admin/cles-api',
      cta: 'Configurer',
    });
  }

  // Tâches planifiées en panne. Un cron qui échoue ne prévient personne : il se
  // contente de ne rien faire. C'est ce silence qui a laissé un job échouer 672
  // fois en une semaine.
  const brokenCrons = cronJobs.filter(isBroken);
  if (brokenCrons.length > 0) {
    items.push({
      level: 'critical',
      title: `${brokenCrons.length} tâche${brokenCrons.length > 1 ? 's' : ''} planifiée${brokenCrons.length > 1 ? 's' : ''} en panne`,
      detail: `${brokenCrons.map((j) => j.jobname).join(', ')} — en échec à la dernière exécution.`,
      href: '/admin/scraping',
      cta: 'Diagnostiquer',
    });
  }

  if (apiPending > 0) {
    items.push({
      level: 'warning',
      title: `${apiPending} demande${apiPending > 1 ? 's' : ''} d'accès API`,
      detail: "En attente d'examen. Un demandeur sans réponse est un partenaire perdu.",
      href: '/admin/api-clients',
      cta: 'Examiner',
    });
  }

  if (paymentsPending > 0) {
    items.push({
      level: 'warning',
      title: `${paymentsPending} paiement${paymentsPending > 1 ? 's' : ''} à confirmer`,
      detail: "L'abonnement n'est pas actif tant que le paiement n'est pas validé.",
      href: '/admin/payments',
      cta: 'Confirmer',
    });
  }

  if (scrapeFailed > 0) {
    items.push({
      level: 'critical',
      title: `${scrapeFailed} scraping${scrapeFailed > 1 ? 's' : ''} en échec (24 h)`,
      detail: 'Sans données fraîches, les signaux et les rapports se périment en silence.',
      href: '/admin/scraping',
      cta: 'Diagnostiquer',
    });
  }

  if (disabledFeatures > 0) {
    items.push({
      level: 'warning',
      title: `${disabledFeatures} fonction${disabledFeatures > 1 ? 's' : ''} désactivée${disabledFeatures > 1 ? 's' : ''}`,
      detail: 'Coupée(s) pour tous les utilisateurs. À réactiver quand la cause est levée.',
      href: '/admin/features',
      cta: 'Réactiver',
    });
  }

  if (failedLogins >= 10) {
    items.push({
      level: 'critical',
      title: `${failedLogins} échecs de connexion (24 h)`,
      detail: "Volume inhabituel : possible tentative d'attaque par force brute.",
      href: '/admin/audit-logs',
      cta: 'Inspecter',
    });
  }

  if (criticalAudit > 0) {
    items.push({
      level: 'info',
      title: `${criticalAudit} action${criticalAudit > 1 ? 's' : ''} critique${criticalAudit > 1 ? 's' : ''} (24 h)`,
      detail: 'Suppression, suspension, révocation ou coupure de fonction.',
      href: '/admin/audit-logs?critical=1',
      cta: 'Vérifier',
    });
  }

  if (opsIncidentsOpen > 0) {
    items.push({
      level: 'critical',
      title: `${opsIncidentsOpen} incident${opsIncidentsOpen > 1 ? 's' : ''} Ops ouvert${opsIncidentsOpen > 1 ? 's' : ''}`,
      detail: 'Incident critique détecté par l’orchestrateur. Prenez en charge ou diagnostiquez avant escalade vocale.',
      href: '/admin/ops',
      cta: 'Traiter',
    });
  }

  if (disabledWorkflows > 0) {
    items.push({
      level: 'critical',
      title: `${disabledWorkflows} workflow${disabledWorkflows > 1 ? 's' : ''} GitHub désactivé${disabledWorkflows > 1 ? 's' : ''}`,
      detail: 'Un workflow désactivé (manuellement ou après 60 j d’inactivité) ne produit plus aucune donnée.',
      href: '/admin/controle',
      cta: 'Inspecter',
    });
  }

  if (coherenceTrompeuses > 0) {
    items.push({
      level: 'warning',
      title: `${coherenceTrompeuses} anomalie${coherenceTrompeuses > 1 ? 's' : ''} de cohérence trompeuse${coherenceTrompeuses > 1 ? 's' : ''}`,
      detail: 'Notation périmée ou étiquette contredite sur une fiche société.',
      href: '/admin/coherence',
      cta: 'Vérifier',
    });
  }

  if (contactsNew > 0) {
    items.push({
      level: 'warning',
      title: `${contactsNew} message${contactsNew > 1 ? 's' : ''} de contact sans réponse`,
      detail: 'En attente de réponse email ou WhatsApp.',
      href: '/admin/contact',
      cta: 'Répondre',
    });
  }

  if (agregatsOpen > 0) {
    items.push({
      level: 'info',
      title: `${agregatsOpen} agrégat${agregatsOpen > 1 ? 's' : ''} bancaire${agregatsOpen > 1 ? 's' : ''} à relire`,
      detail: 'Valeurs en attente d’arbitrage avant publication.',
      href: '/admin/agregats',
      cta: 'Relire',
    });
  }

  // Les urgences d'abord.
  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
