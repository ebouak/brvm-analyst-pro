import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill, MetricCard } from '@/components/ui/premium';
import { listWeeklyReports } from '@/lib/admin/weekly';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapports hebdo — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function weekLabel(slug: string): string {
  const m = slug.match(/(\d{4})-w(\d{2})$/i);
  if (!m) return slug;
  return `S${m[2]} ${m[1]}`;
}

export default async function Page() {
  await requirePermission('content.read');
  const reports = await listWeeklyReports();

  const published = reports.filter((r) => r.status === 'published').length;
  const drafts = reports.filter((r) => r.status === 'draft').length;
  const lastDate = reports[0]?.date_publication ?? null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Rapports hebdomadaires"
        subtitle="Rapports commodity générés chaque vendredi — modération et publication."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Total" value={nf.format(reports.length)} accent="sapphire" />
        <MetricCard label="Publiés" value={nf.format(published)} accent={published > 0 ? 'emerald' : 'neutral'} />
        <MetricCard label="Dernière publication" value={fmtDate(lastDate)} accent="neutral" />
      </div>

      {reports.length === 0 ? (
        <EmptyStatePremium
          title="Aucun rapport hebdomadaire"
          hint="Les rapports sont générés chaque vendredi par commodity_weekly_generator.py."
        />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2a30] text-left text-xs uppercase tracking-wider text-[#6b8a9a]">
                <th className="px-4 py-3 font-medium">Semaine</th>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-[#1a2a30]/40 last:border-0">
                  <td className="px-4 py-3 font-medium text-cyan-400 tabular">{weekLabel(r.slug)}</td>
                  <td className="px-4 py-3 text-[#FCFCFC] max-w-xs truncate">{r.titre}</td>
                  <td className="px-4 py-3 text-[#6b8a9a] tabular">{fmtDate(r.date_publication)}</td>
                  <td className="px-4 py-3">
                    {r.status === 'published' ? (
                      <StatPill tone="emerald">Publié</StatPill>
                    ) : (
                      <StatPill tone="gold">Brouillon</StatPill>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/weekly/${r.slug}`}
                        className="text-xs text-[#6b8a9a] hover:text-[#FCFCFC]"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Aperçu
                      </Link>
                      <Link href={`/admin/weekly/${r.id}`} className="text-xs text-cyan-400 hover:underline">
                        Éditer
                      </Link>
                    </div>
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
