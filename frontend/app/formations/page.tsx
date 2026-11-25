import Link from 'next/link';
import { ArrowUpRight, BookOpen, CalendarDays, GraduationCap, Video, type LucideIcon } from 'lucide-react';
import OffresNiveaux from '@/components/billing/OffresNiveaux';
import { accesAcademy } from '@/lib/server/academyAccess';
import { listFormations, type FormationCard } from '@/lib/formations/server';
import { listPublishedCourses, type AcademyCourseCard } from '@/lib/academy/server';
import { listerSessionsAVenir, type SessionPublique } from '@/lib/formations/sessions';
import { listCourses, type VideoCourseCard } from '@/lib/video/server';
import { NIVEAUX } from '@/lib/academy/types';
import { Lecon0Carte } from '@/components/academy/Lecon0Carte';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';

export const metadata = { title: 'Formations et conférences' };
// Garde par utilisateur (plan Platinium) : rendu dynamique.
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { cours: 'Cours', conference: 'Conférence', webinaire: 'Webinaire' };
const NIVEAU_LABEL: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const NIVEAU_COURSE: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert' };

// Clé de niveau tolérante (casse, accents) : sert à l'affichage et au tri seulement.
const cleNiveau = (n: string | null) =>
  (n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const libelleNiveau = (n: string, table: Record<string, string>) => table[cleNiveau(n)] ?? n;
const rangNiveau = (n: string | null) => {
  const i = (NIVEAUX as readonly string[]).indexOf(cleNiveau(n));
  return i === -1 ? NIVEAUX.length : i;
};
const numeroTitre = (t: string) => Number(/niveau\s*(\d+)/i.exec(t)?.[1] ?? Infinity);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Abidjan' }) : null;
// Heure de la place (Abidjan, UTC+0) : un début en soirée ne change pas de
// jour selon le fuseau du serveur. L'année n'est écrite que si elle diffère.
const fmtJour = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Abidjan',
  });
};
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

/**
 * Carte de parcours : contenu et volume sont issus des lecteurs de destination.
 */
function CarteParcours({
  href,
  titre,
  description,
  volume,
  icon: Icon,
  featured = false,
}: {
  href: string;
  titre: string;
  description: string;
  volume: string;
  icon: LucideIcon;
  featured?: boolean;
}) {
  return (
    <li className="h-full">
      <Link
        href={href}
        className={`group flex h-full min-h-[210px] flex-col rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          featured
            ? 'border-accent/30 bg-gradient-to-br from-accent/10 via-surface to-elevated/50'
            : 'border-border bg-surface hover:bg-elevated/40'
        }`}
      >
        <span className="flex items-start justify-between gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
            featured ? 'border-accent/25 bg-accent/10 text-accent-ink' : 'border-border bg-elevated text-muted'
          }`}>
            <Icon size={18} strokeWidth={1.7} aria-hidden />
          </span>
          <span className="rounded-full border border-border bg-bg/70 px-2.5 py-1 text-[11px] text-muted">{volume}</span>
        </span>
        <span className="mt-5 font-display text-xl leading-tight text-ivory transition-colors [text-wrap:balance] group-hover:text-accent-ink">
          {titre}
        </span>
        <span className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted">{description}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-semibold text-accent-ink">
          Découvrir le parcours <ArrowUpRight size={14} aria-hidden />
        </span>
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
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/10 via-surface to-elevated/50 px-5 py-7 sm:px-8 sm:py-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">WestBourse Academy</p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-medium leading-tight tracking-tight text-ivory sm:text-4xl">
              Comprendre la BRVM, puis passer à la pratique.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Des repères concrets, des cas réels et des formats pour apprendre à votre rythme.
            </p>
          </header>
          <Lecon0Carte />
          <div className="max-w-4xl">
            <OffresNiveaux userId={acces.userId} possedes={acces.niveaux} retour="/formations" />
          </div>
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
    <div className="mx-auto max-w-6xl space-y-9 px-4 py-8 sm:px-6">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/10 via-surface to-elevated/50 px-5 py-7 sm:px-8 sm:py-9">
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.42fr)] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">
              <GraduationCap size={15} aria-hidden />
              Apprendre · comprendre · pratiquer
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-medium leading-tight tracking-tight text-ivory sm:text-4xl lg:text-5xl">
              Comprendre la BRVM, puis passer à la pratique.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Des parcours progressifs, des données réelles et des formats adaptés à votre rythme.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/formations/academy"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Explorer l’Academy <ArrowUpRight size={16} aria-hidden />
              </Link>
              <Link
                href="/formations/sessions"
                className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface/70 px-4 py-2.5 text-sm font-medium text-ivory transition hover:border-accent/40 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Voir les sessions
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-border bg-bg/55 p-4">
              <p className="tabular font-display text-3xl text-ivory">{NIVEAUX.length}</p>
              <p className="mt-1 text-xs text-muted">niveaux pour progresser</p>
            </div>
            <div className="rounded-2xl border border-border bg-bg/55 p-4">
              <p className="tabular font-display text-3xl text-ivory">{courses.length}</p>
              <p className="mt-1 text-xs text-muted">{courses.length > 1 ? 'cours publiés' : 'cours publié'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Leçon 0 : gratuite, ouverte à tous. Seule image réelle de la page. */}
      <section aria-labelledby="h-gratuit" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.48fr)] md:items-stretch">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-up">Un premier pas, sans frais</p>
          <h2 id="h-gratuit" className="mt-2 font-display text-2xl text-ivory">Découvrez la méthode WESTBOURSE</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Commencez par une leçon vidéo ouverte à tous, puis choisissez le parcours qui vous convient.
          </p>
        </div>
        <Lecon0Carte className="h-full" />
      </section>

      <section aria-labelledby="h-parcours" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Choisissez votre rythme</p>
            <h2 id="h-parcours" className="mt-1 font-display text-2xl text-ivory">Les parcours de formation</h2>
          </div>
          <span className="text-xs text-faint">Tous les formats partent de cas BRVM concrets</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CarteParcours
            href="/formations/academy"
            titre="WestBourse Academy"
            description="Progressez par niveau avec des cas réels, des simulateurs, des fiches mémo, des quiz et des certificats."
            volume={volumeAcademy}
            icon={BookOpen}
            featured
          />
          <CarteParcours
            href="/formations/sessions"
            titre="Sessions avec formateur"
            description="Travaillez en petit groupe sur des situations de marché, en ligne ou en présentiel, à date fixe."
            volume={volumeSessions}
            icon={CalendarDays}
          />
          {modules.length > 0 && (
            <CarteParcours
              href="/formations/modules"
              titre="Modules vidéo interactifs"
              description="Suivez des vidéos chapitrées, validez vos acquis par quiz et reprenez votre progression."
              volume={volumeModules}
              icon={Video}
            />
          )}
        </ul>
      </section>

      {/* Cours générés (Academy) */}
      {courses.length > 0 && (
        <section aria-labelledby="h-cours" className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">À découvrir</p>
              <h2 id="h-cours" className="mt-1 font-display text-2xl text-ivory">Quelques cours de l’Academy</h2>
            </div>
            <Link href="/formations/academy" className="text-sm font-medium text-accent-ink hover:underline">
              Explorer tout le catalogue ({courses.length}) →
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...courses]
              .sort((a, b) => rangNiveau(a.niveau) - rangNiveau(b.niveau) || numeroTitre(a.titre) - numeroTitre(b.titre))
              .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/formations/academy/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <h3 className="font-display text-base text-ivory transition-colors line-clamp-2 group-hover:text-accent-ink">
                    {c.titre}
                  </h3>
                  {c.niveau && (
                    <p className="mt-2 w-fit rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] text-muted">
                      {libelleNiveau(c.niveau, NIVEAU_COURSE)}
                    </p>
                  )}
                  {c.resume && <p className="mt-2 text-sm text-muted line-clamp-3">{c.resume}</p>}
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-accent-ink">
                    Ouvrir ce cours <ArrowUpRight size={14} aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Catalogue : replays, webinaires, conférences (masqué si aucun replay publié) */}
      {formations.length > 0 && (
        <section aria-labelledby="h-catalogue" className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Pour aller plus loin</p>
            <h2 id="h-catalogue" className="mt-1 font-display text-2xl text-ivory">Replays et conférences</h2>
          </div>
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
                      <img loading="lazy" decoding="async" src={f.cover_url} alt="" className="h-full w-full object-cover" />
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
                      {f.niveau && <> · {libelleNiveau(f.niveau, NIVEAU_LABEL)}</>}
                      {f.duree_min && (
                        <>
                          {' · '}
                          <><span className="tabular">{f.duree_min}</span> min</>
                        </>
                      )}
                    </p>
                    {f.description && <p className="mt-2 text-sm text-muted line-clamp-2">{f.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
                      <span className="text-faint">{fmtDate(f.date_evenement) ?? ''}</span>
                      <span className="text-muted">Premium</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-faint">
        Les replays et supports sont réservés aux membres Premium.{' '}
        <Link href="/pricing" className="text-accent-ink hover:underline">
          Voir les offres
        </Link>
      </p>
    </div>
  );
}
