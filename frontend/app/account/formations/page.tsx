// frontend/app/account/formations/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes formations' };

const LIBELLE: Record<string, string> = {
  reservee: 'Réservée · en attente de paiement',
  payee: 'Confirmée',
  annulee: 'Annulée',
  presente: 'Suivie',
  absente: 'Absent',
};

export default async function MesFormationsPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login?next=%2Faccount%2Fformations');

  // Clé de service : le lien de visio n'est PAS lisible par la clé anon, et il
  // n'est servi qu'aux inscriptions payées de CET utilisateur.
  const db = getServiceClient();
  const { data } = await db
    .from('formation_inscriptions')
    .select('id, statut, session:formation_sessions(id, titre, debut_at, modalite, lieu, lien_visio)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  type Ligne = { id: string; statut: string; session: { id: string; titre: string; debut_at: string; modalite: string; lieu: string | null; lien_visio: string | null } | null };
  const lignes = (data ?? []) as unknown as Ligne[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <SectionHeader kicker="Mon compte" title="Mes formations" subtitle="Vos inscriptions aux sessions en direct." />
      {lignes.length === 0 ? (
        <EmptyStatePremium
          title="Aucune inscription"
          hint="Les prochaines sessions sont annoncées sur la page des formations."
          action={{ href: '/formations/sessions', label: 'Voir les sessions' }}
        />
      ) : (
        <ul className="space-y-3">
          {lignes.map((l) => (
            <li key={l.id}>
              <PremiumPanel className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatPill tone={l.statut === 'payee' ? 'emerald' : 'neutral'}>{LIBELLE[l.statut] ?? l.statut}</StatPill>
                </div>
                <h2 className="font-display text-base text-ivory">{l.session?.titre ?? 'Séance supprimée'}</h2>
                {l.session && (
                  <p className="text-sm text-muted">
                    {new Date(l.session.debut_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {l.session.modalite === 'presentiel' && l.session.lieu ? ` · ${l.session.lieu}` : ''}
                  </p>
                )}
                {l.statut === 'payee' && l.session?.modalite === 'visio' && l.session.lien_visio && (
                  <a href={l.session.lien_visio} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-ink hover:underline">
                    Rejoindre la session →
                  </a>
                )}
                {l.statut === 'reservee' && (
                  <p className="text-xs text-faint">Votre place sera confirmée dès réception du paiement.</p>
                )}
              </PremiumPanel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
