import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';
import { AlertsManager, type UserAlert } from './AlertsManager';
import WhatsAppPrefs from '@/components/settings/WhatsAppPrefs';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes alertes' };

export default async function AlertesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Niveau requis LU EN BASE (feature_flags, editable dans /admin/features).
  // La page ne decide rien : elle demande.
  const gate = await canAccess('alertes');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="Les alertes personnalisées"
        hint="Soyez prévenu par email et WhatsApp quand un cours franchit votre seuil."
      />
    );
  }

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
      <WhatsAppPrefs userId={user.id} />
      <AlertsManager
        alerts={(alerts ?? []) as UserAlert[]}
        instruments={(instruments ?? []) as { code: string; designation: string | null }[]}
      />
    </div>
  );
}
