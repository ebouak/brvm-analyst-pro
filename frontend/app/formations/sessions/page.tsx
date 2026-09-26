// frontend/app/formations/sessions/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicShell from '@/components/public/PublicShell';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { listerSessionsAVenir } from '@/lib/formations/sessions';

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Formations en direct · Bourse et BRVM',
  description:
    'Sessions de formation animées en direct sur la Bourse et la BRVM : dates, places limitées, tarifs. Places réservées depuis votre compte WESTBOURSE.',
  alternates: { canonical: SITE_URL + '/formations/sessions' },
};

const NIVEAUX: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const fmtPrix = (v: number) => `${v.toLocaleString('fr-FR')} FCFA`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function SessionsPage() {
  const sessions = await listerSessionsAVenir();

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <SectionHeader
          kicker="Formations"
          title="Se former en direct, avec un formateur"
          subtitle="Des sessions à date fixe, en petit groupe. Le parcours Academy reste gratuit et sert de préparation."
        />
        {sessions.length === 0 ? (
          <EmptyStatePremium
            title="Aucune session programmée"
            hint="Les prochaines dates seront annoncées ici. En attendant, l’Academy est accessible librement."
            action={{ href: '/formations/academy', label: 'Ouvrir l’Academy' }}
          />
        ) : (
          <ul className="space-y-4">
            {sessions.map((s) => {
              const restantes = s.places - s.places_prises;
              return (
                <li key={s.id}>
                  <PremiumPanel className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatPill tone="sapphire">{NIVEAUX[s.niveau] ?? s.niveau}</StatPill>
                      <StatPill tone="neutral">{s.modalite === 'visio' ? 'En ligne' : 'Présentiel'}</StatPill>
                      {restantes <= 3 && restantes > 0 && <StatPill tone="neutral">{restantes} place{restantes > 1 ? 's' : ''} restante{restantes > 1 ? 's' : ''}</StatPill>}
                      {restantes <= 0 && <StatPill tone="neutral">Complet</StatPill>}
                    </div>
                    <h2 className="font-display text-lg text-ivory">{s.titre}</h2>
                    <p className="text-sm text-muted">{fmtDate(s.debut_at)} · {Math.round(s.duree_min / 60)} h{s.lieu ? ` · ${s.lieu}` : ''}</p>
                    <p className="tabular text-sm text-ivory">
                      {fmtPrix(Number(s.prix))}
                      {s.prix_abonne != null && <span className="text-muted"> · {fmtPrix(Number(s.prix_abonne))} pour les abonnés</span>}
                    </p>
                    <Link href={`/formations/sessions/${s.id}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-ink hover:underline">
                      Voir la séance et réserver →
                    </Link>
                  </PremiumPanel>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PublicShell>
  );
}
