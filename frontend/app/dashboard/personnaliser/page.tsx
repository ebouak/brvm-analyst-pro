import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';
import DashboardCustomizer from '@/components/dashboard/DashboardCustomizer';
import type { DashboardLayout } from '@/lib/dashboard/widgets';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Personnaliser le tableau de bord' };

export default async function CustomizeDashboardPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: prof } = await sb.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const layout = ((prof?.preferences as Record<string, unknown> | null)?.dashboard as DashboardLayout) ?? null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Tableau de bord"
        title="Personnaliser"
        subtitle="Activez, désactivez et réordonnez vos widgets. Le ticker reste toujours visible."
      />
      <DashboardCustomizer initial={layout} />
      <Link href="/dashboard" className="inline-block text-xs text-accent hover:underline">← Retour au tableau de bord</Link>
    </div>
  );
}
