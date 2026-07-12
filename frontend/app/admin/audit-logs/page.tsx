import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, MetricCard, EmptyStatePremium } from '@/components/ui/premium';
import { loadAuditLogs } from '@/lib/admin/auditLogs';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Journal d'audit — Administration" };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDateTime(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const SEVERITY_STYLE: Record<string, string> = {
  info: 'text-muted',
  warning: 'text-warn',
  critical: 'text-down font-semibold',
};

export default async function Page({
  searchParams,
}: {
  searchParams: { critical?: string; action?: string };
}) {
  await requirePermission('audit.read');

  const criticalOnly = searchParams.critical === '1';
  const action = searchParams.action || undefined;
  const { rows, actions, kpis } = await loadAuditLogs({ criticalOnly, action });

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
        active ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted hover:text-ivory'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Journal d'audit"
        subtitle="Qui a fait quoi, quand, et depuis quelle adresse IP. Les actions destructrices (suspension, suppression, révocation de clé, coupure de fonction) sont marquées « critical »."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Entrées totales" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard
          label="Critiques (24 h)"
          value={nf.format(kpis.critical24h)}
          accent={kpis.critical24h > 0 ? 'gold' : 'neutral'}
        />
        <MetricCard label="Avertissements (24 h)" value={nf.format(kpis.warning24h)} accent="neutral" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tab('Tout', '/admin/audit-logs', !criticalOnly && !action)}
        {tab('⚠ Actions dangereuses', '/admin/audit-logs?critical=1', criticalOnly)}
        {actions.slice(0, 8).map((a) =>
          tab(a, `/admin/audit-logs?action=${encodeURIComponent(a)}`, action === a),
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyStatePremium
          title="Aucune entrée"
          hint={
            criticalOnly
              ? "Aucune action critique enregistrée — c'est une bonne nouvelle."
              : "Les actions d'administration sensibles seront journalisées ici."
          }
        />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Auteur</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Cible</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Gravité</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className={`border-b border-border/40 last:border-0 ${
                    l.severity === 'critical' ? 'bg-down/[0.04]' : ''
                  }`}
                >
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted">
                    {fmtDateTime(l.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="text-ivory">{l.actor_email ?? DASH}</span>
                    {l.actor_role && <span className="ml-1 text-faint">({l.actor_role})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ivory">{l.action}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {l.target_email ?? l.resource_id ?? l.resource_type}
                  </td>
                  {/* L'IP était collectée depuis toujours — mais jamais affichée. */}
                  <td className="tabular px-4 py-2.5 text-xs text-faint">{l.ip_address ?? DASH}</td>
                  <td className={`px-4 py-2.5 ${SEVERITY_STYLE[l.severity] ?? 'text-muted'}`}>
                    {l.severity}
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
