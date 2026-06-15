import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { loadScrapingDashboard } from '@/lib/admin/scraping';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scraping — Administration' };

const DASH = '—';

function fmtDateTime(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return DASH;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const STATUS_STYLE: Record<string, string> = {
  success: 'text-up',
  partial: 'text-warn',
  failed: 'text-down',
  running: 'text-info',
};
const STATUS_LABEL: Record<string, string> = {
  success: 'Succès',
  partial: 'Partiel',
  failed: 'Échec',
  running: 'En cours',
};

export default async function Page() {
  await requirePermission('scraping.read');
  const { runs, errors, kpis } = await loadScrapingDashboard();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Scraping"
        subtitle="Exécutions récentes des collecteurs, taux de réussite et incidents non résolus."
      />
      <div className="gold-rule" />

      <section aria-labelledby="scrap-kpis" className="space-y-3">
        <h2 id="scrap-kpis" className="overline text-faint">Dernières 24 h</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Exécutions" value={new Intl.NumberFormat('fr-FR').format(kpis.runs24h)} accent="sapphire" />
          <MetricCard
            label="Taux de réussite"
            value={kpis.successRate24h == null ? DASH : `${Math.round(kpis.successRate24h * 100)} %`}
            accent={kpis.successRate24h != null && kpis.successRate24h < 0.8 ? 'neutral' : 'emerald'}
          />
          <MetricCard label="Lignes écrites" value={new Intl.NumberFormat('fr-FR').format(kpis.rowsUpserted24h)} accent="neutral" />
          <MetricCard label="Incidents ouverts" value={new Intl.NumberFormat('fr-FR').format(kpis.openErrors)} accent={kpis.openErrors > 0 ? 'gold' : 'neutral'} />
        </div>
      </section>

      <section aria-labelledby="scrap-runs" className="space-y-3">
        <h2 id="scrap-runs" className="overline text-faint">Exécutions récentes</h2>
        {runs.length === 0 ? (
          <EmptyStatePremium title="Aucune exécution enregistrée" hint="Les collecteurs instrumentés apparaîtront ici dès leur première exécution hors mode mock." />
        ) : (
          <PremiumPanel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Déclencheur</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Début</th>
                  <th className="px-4 py-3 font-medium text-right">Durée</th>
                  <th className="px-4 py-3 font-medium text-right tabular">Lignes</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-ivory">{r.source_label ?? r.source_code ?? DASH}</td>
                    <td className="px-4 py-2.5 text-muted">{r.trigger_type}</td>
                    <td className={`px-4 py-2.5 font-medium ${STATUS_STYLE[r.status] ?? 'text-muted'}`}>{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDateTime(r.started_at)}</td>
                    <td className="px-4 py-2.5 text-right text-muted tabular">{fmtDuration(r.duration_ms)}</td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">{new Intl.NumberFormat('fr-FR').format(r.rows_upserted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>
        )}
      </section>

      {errors.length > 0 && (
        <section aria-labelledby="scrap-errors" className="space-y-3">
          <h2 id="scrap-errors" className="overline text-faint">Incidents non résolus</h2>
          <PremiumPanel className="divide-y divide-border/40 p-0">
            {errors.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-down">{e.error_type ?? 'Erreur'}</span>
                  <span className="text-xs text-faint tabular">{fmtDateTime(e.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-muted break-words">{e.error_message ?? DASH}</p>
              </div>
            ))}
          </PremiumPanel>
        </section>
      )}
    </div>
  );
}
