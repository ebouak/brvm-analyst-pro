import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, EmptyStatePremium } from '@/components/ui/premium';
import { loadApiClients } from '@/lib/admin/apiClients';
import { ClientRow } from './ClientRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clients API — Administration' };

const nf = new Intl.NumberFormat('fr-FR');

export default async function Page() {
  await requirePermission('settings.write');
  const { rows, kpis } = await loadApiClients();

  const pending = rows.filter((r) => r.statut === 'pending');
  const others = rows.filter((r) => r.statut !== 'pending');

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <SectionHeader
        kicker="Administration"
        title="Clients de l'API"
        subtitle="L'API BRVM est accessible sur autorisation. Chaque clé est nominative, plafonnée par un quota journalier, et révocable à tout moment."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Demandes en attente"
          value={nf.format(kpis.pending)}
          accent={kpis.pending > 0 ? 'gold' : 'neutral'}
        />
        <MetricCard label="Clés actives" value={nf.format(kpis.active)} accent="emerald" />
        <MetricCard label="Révoquées" value={nf.format(kpis.revoked)} accent="neutral" />
        <MetricCard label="Requêtes aujourd'hui" value={nf.format(kpis.requetesToday)} accent="sapphire" />
      </div>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ivory">
            À examiner ({pending.length})
          </h2>
          {pending.map((c) => (
            <ClientRow key={c.id} c={c} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ivory">Tous les clients</h2>
        {others.length === 0 && pending.length === 0 ? (
          <EmptyStatePremium
            title="Aucun client d'API"
            hint="Les demandes déposées sur /developers apparaîtront ici."
          />
        ) : (
          others.map((c) => <ClientRow key={c.id} c={c} />)
        )}
      </section>
    </div>
  );
}
