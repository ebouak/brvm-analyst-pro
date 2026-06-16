import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadPayments } from '@/lib/admin/payments';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Paiements — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS: Record<string, { label: string; tone: 'gold' | 'emerald' | 'sapphire' | 'neutral' }> = {
  paid: { label: 'Payé', tone: 'emerald' },
  pending: { label: 'En attente', tone: 'sapphire' },
  failed: { label: 'Échec', tone: 'gold' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
};

export default async function Page() {
  await requirePermission('billing.read');
  const { payments, kpis } = await loadPayments();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Paiements"
        subtitle="Transactions de facturation, statut et encaissements (lecture seule)."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Transactions" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Encaissées" value={nf.format(kpis.paid)} accent="emerald" />
        <MetricCard label="Échecs" value={nf.format(kpis.failed)} accent={kpis.failed > 0 ? 'gold' : 'neutral'} />
        <MetricCard label="Montant encaissé" value={nf.format(Math.round(kpis.paidAmount))} unit={kpis.currency} accent="gold" />
      </div>

      {payments.length === 0 ? (
        <EmptyStatePremium title="Aucune transaction" hint="Les paiements apparaîtront ici dès la mise en service du tunnel de paiement." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Méthode</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const st = STATUS[p.status] ?? { label: p.status, tone: 'neutral' as const };
                return (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-ivory">{p.user_email ?? DASH}</td>
                    <td className="px-4 py-2.5 text-muted capitalize">{p.provider}</td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">{nf.format(Math.round(p.amount))} {p.currency}</td>
                    <td className="px-4 py-2.5"><StatPill tone={st.tone}>{st.label}</StatPill></td>
                    <td className="px-4 py-2.5 text-muted">{p.payment_method ?? DASH}</td>
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDate(p.paid_at ?? p.created_at)}</td>
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
