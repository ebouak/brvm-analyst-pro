import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadSubscriptions } from '@/lib/admin/subscriptions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Abonnements — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS: Record<string, { label: string; tone: 'gold' | 'emerald' | 'sapphire' | 'neutral' }> = {
  active: { label: 'Actif', tone: 'emerald' },
  trialing: { label: 'Essai', tone: 'sapphire' },
  past_due: { label: 'Impayé', tone: 'gold' },
  canceled: { label: 'Annulé', tone: 'neutral' },
  expired: { label: 'Expiré', tone: 'neutral' },
};

export default async function Page() {
  await requirePermission('subscriptions.read');
  const { subscriptions, kpis } = await loadSubscriptions();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Abonnements"
        subtitle="Abonnements souscrits, statut et renouvellement (lecture seule)."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Abonnements" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Actifs" value={nf.format(kpis.active)} accent="emerald" />
        <MetricCard label="Impayés" value={nf.format(kpis.pastDue)} accent={kpis.pastDue > 0 ? 'gold' : 'neutral'} />
      </div>

      {subscriptions.length === 0 ? (
        <EmptyStatePremium title="Aucun abonnement" hint="Les abonnements souscrits apparaîtront ici dès la mise en service du paiement." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Cycle</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Début</th>
                <th className="px-4 py-3 font-medium">Renouvellement</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => {
                const st = STATUS[s.status] ?? { label: s.status, tone: 'neutral' as const };
                return (
                  <tr key={s.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-ivory">{s.user_email ?? DASH}</td>
                    <td className="px-4 py-2.5 text-muted">{s.plan_name ?? DASH}</td>
                    <td className="px-4 py-2.5 text-muted">{s.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel'}</td>
                    <td className="px-4 py-2.5"><StatPill tone={st.tone}>{st.label}</StatPill></td>
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDate(s.started_at)}</td>
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDate(s.renews_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
