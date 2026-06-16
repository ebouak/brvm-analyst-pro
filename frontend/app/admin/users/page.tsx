import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadUsers } from '@/lib/admin/users';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Utilisateurs — Administration' };

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
  const { users, kpis } = await loadUsers();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Utilisateurs"
        subtitle="Comptes inscrits, statut premium et onboarding (lecture seule)."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Comptes" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Premium" value={nf.format(kpis.premium)} accent="gold" />
        <MetricCard label="Onboardés" value={nf.format(kpis.onboarded)} accent="emerald" />
      </div>

      {users.length === 0 ? (
        <EmptyStatePremium title="Aucun utilisateur" hint="Les comptes inscrits apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Profil</th>
                <th className="px-4 py-3 font-medium">Onboarding</th>
                <th className="px-4 py-3 font-medium">Inscription</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-ivory">{u.email ?? DASH}</td>
                  <td className="px-4 py-2.5">
                    {u.is_premium ? <StatPill tone="gold">Premium</StatPill> : <StatPill tone="neutral">Gratuit</StatPill>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{u.profil ?? DASH}</td>
                  <td className="px-4 py-2.5 text-muted">{u.onboarding_done ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/users/${u.id}`} className="text-accent hover:underline">Gérer</Link>
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
