import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';
import { AlertsManager, type UserAlert } from './AlertsManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes alertes' };

export default async function AlertesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: alerts }, { data: instruments }] = await Promise.all([
    supabase
      .from('alerts')
      .select('id, code, type, seuil, actif, declenchee_le, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('brvm_instruments')
      .select('code, designation')
      .eq('type', 'action')
      .order('code'),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Paramètres"
        title="Mes alertes"
        subtitle="Soyez notifié dès qu'un titre franchit un seuil de prix, change de signal ou approche d'un détachement de dividende."
      />
      <AlertsManager
        alerts={(alerts ?? []) as UserAlert[]}
        instruments={(instruments ?? []) as { code: string; designation: string | null }[]}
      />
    </div>
  );
}
