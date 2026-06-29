import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, StatPill } from '@/components/ui/premium';
import { getWeeklyReport } from '@/lib/admin/weekly';
import { EditWeeklyForm } from './EditWeeklyForm';

export const dynamic = 'force-dynamic';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return '—';
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function Page({ params }: { params: { id: string } }) {
  await requirePermission('content.publish');
  const report = await getWeeklyReport(params.id);
  if (!report) notFound();

  const tickers = report.ticker_codes ?? [];
  const meta = report.metadata ?? {};

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          kicker="Rapports hebdomadaires"
          title={report.titre}
          subtitle={`Publié le ${fmtDate(report.date_publication)} · ${report.slug}`}
        />
        <Link href="/admin/weekly" className="shrink-0 rounded-lg border border-[#1a2a30] px-3 py-1.5 text-xs text-[#6b8a9a] hover:text-[#FCFCFC]">
          ← Retour
        </Link>
      </div>
      <div className="gold-rule" />

      <div className="flex items-center gap-3">
        {report.status === 'published' ? (
          <StatPill tone="emerald">Publié</StatPill>
        ) : (
          <StatPill tone="gold">Brouillon</StatPill>
        )}
        {tickers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tickers.map((t) => (
              <span key={t} className="rounded border border-cyan-400/20 bg-cyan-400/5 px-2 py-0.5 text-xs text-cyan-400">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <PremiumPanel className="p-5">
        <h2 className="mb-4 font-display text-sm font-semibold text-[#FCFCFC]">Édition</h2>
        <EditWeeklyForm
          id={report.id}
          slug={report.slug}
          initialTitre={report.titre}
          initialResume={report.resume ?? ''}
          initialStatus={report.status}
        />
      </PremiumPanel>

      {Object.keys(meta).length > 0 && (
        <PremiumPanel className="p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-[#FCFCFC]">Métadonnées</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {Object.entries(meta).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-[#6b8a9a]">{k}</dt>
                <dd className="tabular text-[#FCFCFC]">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </PremiumPanel>
      )}
    </div>
  );
}
