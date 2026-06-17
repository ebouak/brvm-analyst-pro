import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadOrganizations } from '@/lib/admin/organizations';
import { CreateOrgForm } from './CreateOrgForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisations — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function Page() {
  await requirePermission('users.read');
  const { rows, kpis } = await loadOrganizations();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Organisations"
        subtitle="Comptes entreprise : membres, rôles et abonnement rattaché (premium hérité)."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Organisations" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Avec abonnement actif" value={nf.format(kpis.withActiveSub)} accent={kpis.withActiveSub > 0 ? 'emerald' : 'neutral'} />
        <MetricCard label="Membres cumulés" value={nf.format(kpis.members)} accent="neutral" />
      </div>

      <CreateOrgForm />

      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucune organisation" hint="Créez un compte entreprise pour regrouper des membres sous un abonnement." />
      ) : (
        <PremiumPanel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Organisation</th>
                <th className="px-4 py-3 font-medium">Propriétaire</th>
                <th className="px-4 py-3 font-medium">Membres</th>
                <th className="px-4 py-3 font-medium">Abonnement</th>
                <th className="px-4 py-3 font-medium">Créée le</th>
                <th className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium text-ivory">{o.name}</td>
                  <td className="px-4 py-3 text-muted">{o.owner_email ?? DASH}</td>
                  <td className="tabular px-4 py-3 text-muted">{nf.format(o.member_count)}</td>
                  <td className="px-4 py-3">
                    {o.subscription ? (
                      <StatPill tone={o.subscription.status === 'active' ? 'emerald' : 'neutral'}>
                        {o.subscription.plan ?? 'plan'} · {o.subscription.status}
                      </StatPill>
                    ) : (
                      <span className="text-xs text-faint">{DASH}</span>
                    )}
                  </td>
                  <td className="tabular px-4 py-3 text-muted">{fmtDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/organizations/${o.id}`} className="text-xs text-sapphire hover:underline">
                      Gérer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
