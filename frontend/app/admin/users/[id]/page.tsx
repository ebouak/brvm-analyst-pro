import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { getUserRights, listRoles } from '@/lib/admin/roles';
import { RightsPanel } from './RightsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Utilisateur — Administration' };

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requirePermission('users.read');
  const [rights, allRoles] = await Promise.all([getUserRights(params.id), listRoles()]);
  if (!rights) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/users" className="text-sm text-muted hover:text-ivory">← Utilisateurs</Link>
      <SectionHeader kicker="Administration" title={rights.email ?? params.id} subtitle="Droits, statut premium et envoi d'email." />
      <div className="flex items-center gap-2">
        {rights.is_premium ? <StatPill tone="gold">Premium</StatPill> : <StatPill tone="neutral">Gratuit</StatPill>}
        {rights.roleCodes.map((c) => <StatPill key={c} tone="sapphire">{c}</StatPill>)}
      </div>
      <div className="gold-rule" />
      <RightsPanel
        userId={rights.id}
        isPremium={rights.is_premium}
        roleCodes={rights.roleCodes}
        allRoles={allRoles}
        canManageRoles={ctx.isSuperAdmin}
      />
    </div>
  );
}
