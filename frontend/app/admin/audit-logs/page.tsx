import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { loadAuditLogs } from '@/lib/admin/auditLogs';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Journal d'audit — Administration" };

const DASH = '—';

function fmtDateTime(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const SEVERITY_STYLE: Record<string, string> = {
  info: 'text-muted',
  warning: 'text-warn',
  critical: 'text-down',
};

export default async function Page() {
  await requirePermission('audit.read');
  const logs = await loadAuditLogs();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Journal d'audit"
        subtitle="Traçabilité des actions d'administration (lecture seule)."
      />
      <div className="gold-rule" />

      {logs.length === 0 ? (
        <EmptyStatePremium title="Aucune entrée d'audit" hint="Les actions d'administration sensibles seront journalisées ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Ressource</th>
                <th className="px-4 py-3 font-medium">Gravité</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDateTime(l.created_at)}</td>
                  <td className="px-4 py-2.5 text-muted">{l.actor_role ?? DASH}</td>
                  <td className="px-4 py-2.5 text-ivory">{l.action}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {l.resource_type}{l.resource_id ? ` · ${l.resource_id}` : ''}
                  </td>
                  <td className={`px-4 py-2.5 font-medium ${SEVERITY_STYLE[l.severity] ?? 'text-muted'}`}>{l.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
