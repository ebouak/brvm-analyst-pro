import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import { loadOrganization } from '@/lib/admin/organizations';
import { OrgHeader } from './OrgHeader';
import { OrgMembersPanel } from '../OrgMembersPanel';
import { OrgSubscriptionPanel } from '../OrgSubscriptionPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisation — Administration' };

export default async function Page({ params }: { params: { id: string } }) {
  await requirePermission('users.read');
  const org = await loadOrganization(params.id);
  if (!org) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/organizations" className="text-xs text-sapphire hover:underline">
        ← Organisations
      </Link>

      <SectionHeader kicker="Administration" title={org.name} subtitle={org.owner_email ? `Propriétaire : ${org.owner_email}` : 'Sans propriétaire désigné'} />
      <div className="gold-rule" />

      <OrgHeader id={org.id} name={org.name} />

      <div className="space-y-1.5">
        <p className="overline text-faint">Membres</p>
        <PremiumPanel className="p-5">
          <OrgMembersPanel orgId={org.id} members={org.members} />
        </PremiumPanel>
      </div>

      <div className="space-y-1.5">
        <p className="overline text-faint">Abonnement</p>
        <PremiumPanel className="p-5">
          <OrgSubscriptionPanel orgId={org.id} subscription={org.subscription} linkableSubs={org.linkableSubs} />
        </PremiumPanel>
      </div>
    </div>
  );
}
