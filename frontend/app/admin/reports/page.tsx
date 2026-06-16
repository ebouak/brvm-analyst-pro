import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadDiagnostics, loadMonthlyReports } from '@/lib/admin/aiReports';
import { InvalidateButton } from './InvalidateButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapports IA — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');
type Tab = 'diagnostics' | 'mensuels';

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function Page({ searchParams }: { searchParams: { tab?: string } }) {
  await requirePermission('content.read');
  const tab: Tab = searchParams.tab === 'mensuels' ? 'mensuels' : 'diagnostics';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Rapports IA"
        subtitle="Diagnostics sell-side par action et rapports mensuels par utilisateur — fraîcheur, export, régénération."
      />
      <div className="gold-rule" />

      <nav className="flex gap-2">
        {([['diagnostics', 'Diagnostics'], ['mensuels', 'Rapports mensuels']] as [Tab, string][]).map(([t, label]) => (
          <Link
            key={t}
            href={`/admin/reports?tab=${t}`}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${t === tab ? 'bg-accent text-obsidian font-semibold' : 'border border-border text-muted hover:text-ivory'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'diagnostics' ? <DiagnosticsTab /> : <MonthlyTab />}
    </div>
  );
}

async function DiagnosticsTab() {
  const { rows, kpis } = await loadDiagnostics();
  const models = Object.entries(kpis.byModel)
    .map(([m, n]) => `${m} (${n})`)
    .join(', ');

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Diagnostics" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Périmés" value={nf.format(kpis.stale)} accent={kpis.stale > 0 ? 'gold' : 'neutral'} />
        <MetricCard label="Modèles" value={models || DASH} accent="neutral" />
      </div>

      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucun diagnostic généré" hint="Les diagnostics sont créés à la première consultation d’une action." />
      ) : (
        <PremiumPanel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Modèle</th>
                <th className="px-4 py-3 font-medium">Généré le</th>
                <th className="px-4 py-3 font-medium">Fraîcheur</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium text-ivory">{r.code}</td>
                  <td className="px-4 py-3 text-muted">{r.model_used}</td>
                  <td className="tabular px-4 py-3 text-muted">{fmtDate(r.generated_at)}</td>
                  <td className="px-4 py-3">
                    {r.stale ? <StatPill tone="gold">Périmé</StatPill> : <StatPill tone="emerald">À jour</StatPill>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/premium/diagnostic/${r.code}`} className="text-xs text-sapphire hover:underline">
                        Voir
                      </Link>
                      <a href={`/admin/reports/export/${r.code}`} className="text-xs text-muted hover:text-ivory">
                        Exporter
                      </a>
                      <InvalidateButton code={r.code} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </>
  );
}

async function MonthlyTab() {
  const { rows, kpis } = await loadMonthlyReports();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Rapports" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Envoyés" value={nf.format(kpis.sent)} accent={kpis.sent > 0 ? 'emerald' : 'neutral'} />
      </div>

      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucun rapport mensuel" hint="Les rapports mensuels sont générés par le pipeline planifié." />
      ) : (
        <PremiumPanel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Mois</th>
                <th className="px-4 py-3 font-medium">Envoyé le</th>
                <th className="px-4 py-3 text-right font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-ivory">{r.user_email ?? DASH}</td>
                  <td className="tabular px-4 py-3 text-muted">{r.month}</td>
                  <td className="tabular px-4 py-3 text-muted">{fmtDate(r.sent_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.report_url ? (
                      <a href={r.report_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sapphire hover:underline">
                        Ouvrir
                      </a>
                    ) : (
                      <span className="text-xs text-faint">{DASH}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </>
  );
}
