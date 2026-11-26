import { can, requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader } from '@/components/ui/premium';
import CalendrierClient, { type FerieRow } from './CalendrierClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calendrier fériés BRVM — Administration' };

export default async function CalendrierAdminPage() {
  const ctx = await requirePermission('scraping.read');
  const canEdit = can(ctx, 'scraping.configure');
  const db = getServiceClient();

  const { data } = await db
    .from('market_calendar')
    .select('date, country_code, holiday_name, notes')
    .eq('is_trading_day', false)
    .order('date', { ascending: false })
    .limit(100);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Calendrier des jours fériés BRVM"
        subtitle="Les dates enregistrées ici neutralisent les alertes de clôture et de séance manquante dans la Tour de contrôle."
      />
      <div className="gold-rule" />
      <CalendrierClient rows={(data ?? []) as FerieRow[]} canEdit={canEdit} />
    </div>
  );
}
