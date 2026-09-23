// frontend/app/formations/sessions/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicShell from '@/components/public/PublicShell';
import { SectionHeader, PremiumPanel, StatPill } from '@/components/ui/premium';
import { createClient } from '@/lib/supabase/server';
import { lireSessionPublique } from '@/lib/formations/sessions';
import { placeDisponible, type SessionTarif } from '@/lib/formations/regles';
import BoutonReserver from './BoutonReserver';

// La disponibilité et l'état de connexion changent à chaque visite : pas de cache.
export const dynamic = 'force-dynamic';

const NIVEAUX: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const fmtPrix = (v: number) => `${v.toLocaleString('fr-FR')} FCFA`;

export default async function SessionPage({ params }: { params: { id: string } }) {
  const s = await lireSessionPublique(params.id);
  if (!s) notFound();

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  const restantes = s.places - s.places_prises;
  const ouverte = placeDisponible(s as unknown as SessionTarif);

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <SectionHeader
          kicker={NIVEAUX[s.niveau] ?? s.niveau}
          title={s.titre}
          subtitle={new Date(s.debut_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        />

        <PremiumPanel className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <StatPill tone="neutral">{s.modalite === 'visio' ? 'En ligne' : 'Présentiel'}</StatPill>
            <StatPill tone="neutral">{Math.round(s.duree_min / 60)} h</StatPill>
            <StatPill tone={restantes > 0 ? 'emerald' : 'neutral'}>
              {restantes > 0 ? `${restantes} place${restantes > 1 ? 's' : ''} sur ${s.places}` : 'Complet'}
            </StatPill>
          </div>
          {s.description && <p className="whitespace-pre-line text-sm text-muted">{s.description}</p>}
          {s.lieu && <p className="text-sm text-muted">{s.modalite === 'visio' ? 'Lien transmis après confirmation du paiement.' : s.lieu}</p>}
          <p className="tabular text-lg text-ivory">
            {fmtPrix(Number(s.prix))}
            {s.prix_abonne != null && <span className="text-sm text-muted"> · {fmtPrix(Number(s.prix_abonne))} pour les abonnés</span>}
          </p>
        </PremiumPanel>

        <PremiumPanel className="space-y-3 p-5">
          {!ouverte ? (
            <p className="text-sm text-muted">Cette séance n’accepte plus d’inscription.</p>
          ) : user ? (
            <BoutonReserver sessionId={s.id} libelle="Réserver ma place" />
          ) : (
            <>
              <p className="text-sm text-muted">La réservation se fait depuis votre compte. Il est gratuit et sans carte bancaire.</p>
              <Link
                href={`/signup?next=${encodeURIComponent(`/formations/sessions/${s.id}`)}`}
                className="inline-flex min-h-[48px] items-center rounded-lg bg-accent px-5 text-sm font-semibold text-obsidian"
              >
                Créer mon compte et réserver
              </Link>
            </>
          )}
          <p className="text-xs text-faint">
            La place est confirmée à réception du paiement (Wave, Orange Money ou virement). Une session enseigne une
            méthode ; elle ne constitue pas un conseil en investissement.
          </p>
        </PremiumPanel>
      </div>
    </PublicShell>
  );
}
