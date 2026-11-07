import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import OffresNiveaux from '@/components/billing/OffresNiveaux';
import { accesAcademy } from '@/lib/server/academyAccess';
import { listFormations, type FormationCard } from '@/lib/formations/server';
import { listPublishedCourses, type AcademyCourseCard } from '@/lib/academy/server';
import { listerSessionsAVenir, type SessionPublique } from '@/lib/formations/sessions';
import { listCourses, type VideoCourseCard } from '@/lib/video/server';
import { NIVEAUX } from '@/lib/academy/types';
import { SectionHeader } from '@/components/ui/premium';
import { Lecon0Carte } from '@/components/academy/Lecon0Carte';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';

export const metadata = { title: 'Formations et conférences' };
// Garde par utilisateur (plan Platinium) : rendu dynamique.
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { cours: 'Cours', conference: 'Conférence', webinaire: 'Webinaire' };
const NIVEAU_LABEL: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const NIVEAU_COURSE: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert' };

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
// Heure de la place (Abidjan, UTC+0) : un début en soirée ne change pas de
// jour selon le fuseau du serveur. L'année n'est écrite que si elle diffère.
const fmtJour = (d: string) => {
  const date = new Date(d);
  const memeAnnee = date.getUTCFullYear() === new Date().getUTCFullYear();
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(memeAnnee ? {} : { year: 'numeric' }),
    timeZone: 'Africa/Abidjan',
  });
};
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

/**
 * Une ligne du programme, lue comme une ligne de cote : le parcours, ce qu'on
 * y trouve, puis son volume RÉEL (lu en base, jamais saisi). Toute la ligne est
 * un seul lien.
 */
function LigneParcours({
  href,
  titre,
  description,
  volume,
}: {
  href: string;
  titre: string;
  description: string;
  volume: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-[56px] flex-col gap-1 px-4 py-4 transition-colors duration-150 hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,11rem)] md:items-baseline md:gap-6 md:px-5"
      >
        <span className="font-display text-lg text-ivory transition-colors [text-wrap:balance] group-hover:text-accent-ink">
          {titre}
        </span>
        <span className="max-w-[60ch] text-sm leading-relaxed text-muted">{description}</span>
        <span className="tabular text-sm text-muted md:text-right">{volume}</span>
      </Link>
    </li>
  );
}

export default async function FormationsPage() {
  // Niveau requis LU EN BASE (feature_flags, editable dans /admin/features).
  // La page ne decide rien : elle demande.
  const gate = await canAccess('formations');
  if (!gate.allowed) {
    const acces = await accesAcademy();
    return (
      <>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 sm:px-6">
          <Lecon0Carte />
          <OffresNiveaux userId={acces.userId} possedes={acces.niveaux} retour="/formations" />
        </div>
        <AccessGate
          required={gate.required === 'free' ? 'premium' : gate.required}
          feature="Les formations et conférences"
          hint="Cours, webinaires et conférences de l'Académie WESTBOURSE."
        />
      </>
    );
  }

  // Sessions et modules : les lecteurs de lib/ rendent [] AUSSI en cas d'erreur
  // Supabase. Une liste vide ne prouve donc pas l'absence : on n'affiche un
  // volume que s'il y a quelque chose à compter, sinon un libellé neutre.
  const [formations, courses, sessions, modules] = await Promise.all([
    listFormations().catch(() => [] as FormationCard[]),
    listPublishedCourses().catch(() => [] as AcademyCourseCard[]),
    listerSessionsAVenir().catch(() => [] as SessionPublique[]),
    listCourses().catch(() => [] as VideoCourseCard[]),
  ]);

  // Volumes du programme : comptés dans les sources qui servent les pages
  // de destination, pour ne jamais annoncer un nombre que la page suivante
  // contredirait.
  const volumeSessions =
    sessions.length > 0
      ? `${pluriel(sessions.length, 'date')} · dès le ${fmtJour(sessions[0].debut_at)}`
      : 'Voir le calendrier';
  const volumeAcademy =
    courses.length > 0 ? `${pluriel(courses.length, 'cours', 'cours')} · ${NIVEAUX.length} niveaux` : `${NIVEAUX.length} niveaux`;
  const volumeModules = modules.length > 0 ? pluriel(modules.length, 'module') : 'Voir les modules';

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <SectionHeader
        title="Formations et conférences"
        subtitle="Cours, sessions en direct, replays et conférences pour apprendre à investir à la BRVM."
      />

      {/* Leçon 0 : gratuite, ouverte à tous. Seule image réelle de la page. */}
      <Lecon0Carte />

      {/* Le programme : trois parcours, lus comme une cote. */}
      <section aria-labelledby="h-parcours" className="space-y-3">
        <h2 id="h-parcours" className="font-display text-lg text-ivory">
          Les parcours
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          <LigneParcours
            href="/formations/sessions"
            titre="Sessions en direct, avec un formateur"
            description="En petit groupe, à date fixe, en ligne ou en présentiel. On y travaille des cas réels de la BRVM. L’Academy prépare à ces sessions, et la leçon 0 reste gratuite pour tous."
            volume={volumeSessions}
          />
          <LigneParcours
            href="/formations/academy"
            titre="WestBourse Academy"
            description="Des cours par niveau, avec définitions, cas réels de la BRVM, pièges fréquents, lexique et points à retenir. Des quiz en chemin, puis un examen et un certificat par niveau. Incluse dans l’abonnement Premium."
            volume={volumeAcademy}
          />
          <LigneParcours
            href="/formations/modules"
            titre="Modules vidéo interactifs"
            description="Des cours en vidéo découpés en chapitres, avec quiz de validation. Votre progression est enregistrée : vous reprenez là où vous vous étiez arrêté."
            volume={volumeModules}
          />
        </ul>
      </section>

      {/* Cours générés (Academy) */}
      {courses.length > 0 && (
        <section aria-labelledby="h-cours" className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="h-cours" className="font-display text-lg text-ivory">
              Cours de l’Academy
            </h2>
            <span className="tabular text-sm text-muted">{pluriel(courses.length, 'cours', 'cours')}</span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/formations/academy/${c.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <h3 className="font-display text-base text-ivory transition-colors line-clamp-2 group-hover:text-accent-ink">
                    {c.titre}
                  </h3>
                  {c.niveau && <p className="mt-1 text-xs text-faint">{NIVEAU_COURSE[c.niveau] ?? c.niveau}</p>}
                  {c.resume && <p className="mt-2 text-sm text-muted line-clamp-3">{c.resume}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Catalogue : replays, webinaires, conférences */}
      <section aria-labelledby="h-catalogue" className="space-y-3">
        <h2 id="h-catalogue" className="font-display text-lg text-ivory">
          Replays et conférences
        </h2>
        {formations.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <p className="text-sm text-muted">Aucune formation à afficher pour l’instant</p>
            <p className="mt-1 text-xs text-faint">Les replays et conférences publiés apparaîtront ici.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/premium/formations/${f.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <div className="aspect-video bg-elevated">
                    {f.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-faint">
                        <GraduationCap size={28} strokeWidth={1.5} aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-display text-base text-ivory transition-colors line-clamp-2 group-hover:text-accent-ink">
                      {f.titre}
                    </h3>
                    <p className="mt-1 text-xs text-faint">
                      {TYPE_LABEL[f.type] ?? f.type}
                      {f.niveau && <> · {NIVEAU_LABEL[f.niveau] ?? f.niveau}</>}
                      {f.duree_min && (
                        <>
                          {' · '}
                          <span className="tabular">{f.duree_min} min</span>
                        </>
                      )}
                    </p>
                    {f.description && <p className="mt-2 text-sm text-muted line-clamp-2">{f.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
                      <span className="tabular text-faint">{fmtDate(f.date_evenement) ?? ''}</span>
                      <span className="text-muted">Premium</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-faint">
        Les replays et supports sont réservés aux membres Premium.{' '}
        <Link href="/pricing" className="text-accent-ink hover:underline">
          Voir les offres
        </Link>
      </p>
    </div>
  );
}
