'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Compass,
  PlayCircle,
  Search,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  OBJECTIFS_LEARNING,
  construireFiltresCapsules,
  filtrerCours,
  formatDuree,
  recommanderPourObjectif,
  type ActiviteCalendrier,
  type CapsuleFiltreId,
  type HubCourseEnriched,
  type ObjectifId,
} from '@/lib/academy/capsules';
import { NIVEAUX, NIVEAU_LABEL } from '@/lib/academy/types';
import { Lecon0Carte } from './Lecon0Carte';

type TabId = 'explorer' | 'en_cours' | 'termines' | 'certificats';

export interface CertificatEtat {
  id: string;
  niveau: string;
  display_name: string;
  consent_at: string;
  revoked: boolean;
}

interface Props {
  courses: HubCourseEnriched[];
  displayName: string | null;
  resumeTarget: { slug: string; lessonIdx: number } | null;
  calendrier: ActiviteCalendrier;
  certificats: CertificatEtat[];
  examensReussis: string[];
  complet: boolean;
}

const GOAL_KEY = 'wb_academy_goal';
const WEEKLY_KEY = 'wb_academy_weekly_goal';
const WEEKLY_OPTIONS = [2, 3, 5] as const;

const NIVEAU_VISUEL: Record<string, { badge: string; accent: string }> = {
  debutant: { badge: 'Niveau 1', accent: 'from-accent/20 via-elevated to-surface' },
  intermediaire: { badge: 'Niveau 2', accent: 'from-up/20 via-elevated to-surface' },
  avance: { badge: 'Niveau 3', accent: 'from-warn/20 via-elevated to-surface' },
  expert: { badge: 'Niveau 4', accent: 'from-purple/25 via-elevated to-surface' },
};

function capsuleStyle(ton: 'up' | 'accent' | 'purple' | 'neutre'): string {
  if (ton === 'up') return 'bg-up/15 text-up border border-up/25';
  if (ton === 'accent') return 'bg-accent/15 text-accent-ink border border-accent/25';
  if (ton === 'purple') return 'bg-purple/15 text-purple border border-purple/25';
  return 'border border-border bg-elevated/60 text-muted';
}

export default function AcademyCatalogCoursera({
  courses,
  displayName,
  resumeTarget,
  calendrier,
  certificats,
  examensReussis,
  complet,
}: Props) {
  const [tab, setTab] = useState<TabId>('explorer');
  const [filtre, setFiltre] = useState<CapsuleFiltreId>('tous');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [goal, setGoal] = useState<ObjectifId | null>(null);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(3);

  useEffect(() => {
    try {
      const savedGoal = window.localStorage.getItem(GOAL_KEY) as ObjectifId | null;
      if (savedGoal && OBJECTIFS_LEARNING.some((o) => o.id === savedGoal)) {
        setGoal(savedGoal);
      } else {
        setGoalPickerOpen(true);
      }
      const savedWeekly = Number(window.localStorage.getItem(WEEKLY_KEY));
      if (WEEKLY_OPTIONS.includes(savedWeekly as 2 | 3 | 5)) {
        setWeeklyGoal(savedWeekly);
      }
    } catch {
      // localStorage indisponible (navigation privée stricte) : état par défaut conservé.
    }
  }, []);

  const chooseGoal = (id: ObjectifId) => {
    setGoal(id);
    setGoalPickerOpen(false);
    try {
      window.localStorage.setItem(GOAL_KEY, id);
    } catch {
      // ignorer
    }
  };

  const cycleWeeklyGoal = () => {
    const next = WEEKLY_OPTIONS[(WEEKLY_OPTIONS.indexOf(weeklyGoal as 2 | 3 | 5) + 1) % WEEKLY_OPTIONS.length] ?? 3;
    setWeeklyGoal(next);
    try {
      window.localStorage.setItem(WEEKLY_KEY, String(next));
    } catch {
      // ignorer
    }
  };

  const filtres = useMemo(() => construireFiltresCapsules(courses), [courses]);
  const recommandes = useMemo(() => recommanderPourObjectif(courses, goal), [courses, goal]);

  const enCoursList = useMemo(() => filtrerCours(courses, { tab: 'en_cours' }), [courses]);
  const terminesList = useMemo(() => filtrerCours(courses, { tab: 'termines' }), [courses]);

  const visibleCourses = useMemo(() => {
    if (tab === 'certificats') return [];
    const list = filtrerCours(courses, { tab, filtre, query });
    if (goal && tab === 'explorer' && filtre === 'tous' && !query.trim()) {
      return [...list].sort((a, b) => Number(recommandes.has(b.slug)) - Number(recommandes.has(a.slug)));
    }
    return list;
  }, [courses, tab, filtre, query, goal, recommandes]);

  const featuredResumeCourse = useMemo(() => {
    if (resumeTarget) {
      const found = courses.find((c) => c.slug === resumeTarget.slug);
      if (found) return found;
    }
    return enCoursList[0] ?? null;
  }, [courses, resumeTarget, enCoursList]);

  const totalStats = useMemo(
    () => ({
      courses: courses.length,
      lessons: courses.reduce((s, c) => s + c.lessonsCount, 0),
      sims: courses.reduce((s, c) => s + c.simulatorsCount, 0),
      quiz: courses.reduce((s, c) => s + c.quizCount, 0),
    }),
    [courses],
  );

  const initials = (displayName ?? 'WB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const activeGoalObj = OBJECTIFS_LEARNING.find((o) => o.id === goal) ?? null;
  const certsActifs = certificats.filter((c) => !c.revoked);

  const displayedExplorer =
    tab === 'explorer' && !showAll && !query.trim() && visibleCourses.length > 6
      ? visibleCourses.slice(0, 6)
      : visibleCourses;

  return (
    <div className="space-y-8">
      {/* ── En-tête personnalisé + recherche (type Coursera Mon apprentissage) ── */}
      <header className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/formations" className="text-sm text-muted transition-colors hover:text-ivory">
            ← Formations
          </Link>
          <div className="relative w-full sm:w-80">
            <Search
              aria-hidden
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (tab === 'certificats') setTab('explorer');
              }}
              placeholder="Que souhaitez-vous apprendre ?"
              aria-label="Rechercher un cours ou un module"
              className="w-full rounded-full border border-border bg-surface py-2 pl-10 pr-9 text-sm text-ivory placeholder:text-faint transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ivory"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/15 font-display text-base font-semibold text-accent-ink"
            >
              {initials || 'WB'}
            </div>
            <div>
              <h1 className="font-display text-2xl font-medium tracking-tight text-ivory sm:text-3xl">
                {displayName ? `Bon retour, ${displayName}` : 'WestBourse Academy'}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span>
                  {activeGoalObj ? (
                    <>
                      Objectif actif : <strong className="font-medium text-ivory">{activeGoalObj.titre}</strong>
                    </>
                  ) : (
                    'Cours interactifs BRVM avec données réelles de marché, simulateurs et certificats.'
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setGoalPickerOpen((v) => !v)}
                  className="font-medium text-accent-ink hover:underline"
                >
                  {goalPickerOpen ? 'Fermer' : activeGoalObj ? 'Modifier l’objectif' : 'Définir mon objectif'}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Bandeau intelligent : capsules d'objectif */}
        {goalPickerOpen && (
          <div className="rounded-2xl border border-border bg-surface/90 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-ivory">
                <Sparkles size={16} className="shrink-0 text-accent-ink" aria-hidden />
                <span>Quel est votre objectif principal à la BRVM ? Les cours correspondants seront mis en avant.</span>
              </div>
              {goal && (
                <button
                  type="button"
                  onClick={() => setGoalPickerOpen(false)}
                  aria-label="Masquer le sélecteur d'objectif"
                  className="text-faint hover:text-ivory"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {OBJECTIFS_LEARNING.map((o) => {
                const actif = goal === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => chooseGoal(o.id)}
                    className={`rounded-xl border px-3.5 py-3 text-left transition ${
                      actif
                        ? 'border-accent bg-accent/10 text-ivory'
                        : 'border-border bg-bg/60 text-muted hover:border-border-strong hover:text-ivory'
                    }`}
                  >
                    <p className="text-sm font-semibold text-ivory">{o.titre}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{o.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── Onglets soulignés (Explorer / En cours / Terminés / Certificats) ── */}
      <nav aria-label="Vues de l'Academy" className="border-b border-border">
        <div className="-mb-px flex gap-6 overflow-x-auto" role="tablist">
          {(
            [
              ['explorer', 'Explorer', courses.length],
              ['en_cours', 'En cours', enCoursList.length],
              ['termines', 'Terminés', terminesList.length],
              ['certificats', 'Certificats', certsActifs.length],
            ] as const
          ).map(([id, label, count]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition ${
                  active
                    ? 'border-accent text-ivory'
                    : 'border-transparent text-muted hover:text-ivory'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`tabular rounded-full px-2 py-0.5 text-[11px] ${
                    active ? 'bg-accent/15 text-accent-ink' : 'bg-elevated text-faint'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Section "Mon apprentissage" : Reprendre + Calendrier d'activité (Explorer si entamé, ou En cours) ── */}
      {(tab === 'en_cours' || (tab === 'explorer' && featuredResumeCourse && !query.trim())) && (
        <section aria-label="Mon apprentissage" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {featuredResumeCourse ? (
            <div className="flex flex-col justify-between rounded-2xl border border-border-strong bg-surface p-5 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
                    <PlayCircle size={13} aria-hidden />
                    Reprendre où vous en étiez
                  </span>
                  {featuredResumeCourse.niveau && (
                    <span className="text-xs text-muted">
                      {NIVEAU_LABEL[featuredResumeCourse.niveau as keyof typeof NIVEAU_LABEL] ?? featuredResumeCourse.niveau}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 font-display text-xl font-medium text-ivory">{featuredResumeCourse.titre}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="tabular font-medium text-ivory">{featuredResumeCourse.progress.pct} % terminé</span>
                  <span aria-hidden>·</span>
                  <span className="tabular">
                    {featuredResumeCourse.progress.done} / {featuredResumeCourse.lessonsCount} leçons
                  </span>
                  {featuredResumeCourse.totalMinutes > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular">{formatDuree(featuredResumeCourse.totalMinutes)} au total</span>
                    </>
                  )}
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${featuredResumeCourse.progress.pct}%` }}
                  />
                </div>
              </div>

              {featuredResumeCourse.nextLessonTitle && (
                <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-border bg-sunken/70 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Prochaine leçon</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-ivory">
                      {featuredResumeCourse.nextLessonTitle}
                    </p>
                    {featuredResumeCourse.nextLessonCapsules.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {featuredResumeCourse.nextLessonCapsules.slice(0, 4).map((cap, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted"
                          >
                            {cap.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/formations/academy/${featuredResumeCourse.slug}?lecon=${featuredResumeCourse.progress.nextIdx + 1}`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 active:scale-[0.98]"
                  >
                    <span>Reprendre</span>
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6">
              <div>
                <h2 className="font-display text-lg text-ivory">Aucun cours en cours pour l’instant</h2>
                <p className="mt-1 text-sm text-muted">
                  Démarrez par la Leçon 0 vidéo ou ouvrez le Niveau 1 : votre progression, vos quiz et vos notes seront
                  sauvegardés automatiquement.
                </p>
              </div>
              <div className="mt-5">
                <Lecon0Carte />
              </div>
            </div>
          )}

          {/* Widget Calendrier & objectif hebdomadaire */}
          <CalendrierActiviteCard
            calendrier={calendrier}
            weeklyGoal={weeklyGoal}
            onCycleWeeklyGoal={cycleWeeklyGoal}
          />
        </section>
      )}

      {/* ── ONGLET EXPLORER : Panneau Catalogue Coursera à capsules intelligentes ── */}
      {tab === 'explorer' && (
        <section
          aria-labelledby="h-catalogue-coursera"
          className="rounded-2xl border border-border bg-sunken/70 p-5 sm:p-7"
        >
          <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Colonne gauche d'accroche factuelle */}
            <aside className="flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">Programme structuré</p>
                <h2
                  id="h-catalogue-coursera"
                  className="mt-2 font-display text-2xl font-medium leading-tight text-ivory [text-wrap:balance]"
                >
                  Maîtriser la BRVM étape par étape
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  <span className="tabular font-medium text-ivory">{totalStats.courses} parcours</span> regroupant{' '}
                  <span className="tabular">{totalStats.lessons} leçons</span>,{' '}
                  <span className="tabular">{totalStats.sims} simulateurs</span> interactifs et{' '}
                  <span className="tabular">{totalStats.quiz} questions</span> de quiz sur données réelles de marché.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/formations/sessions"
                    className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
                  >
                    Sessions en direct <ChevronRight size={15} aria-hidden />
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Accès libre</p>
                <p className="mt-1 text-sm font-medium text-ivory">Leçon 0 · vidéo d’ouverture</p>
                <p className="mt-0.5 text-xs text-muted">Gratuite et ouverte à tous pour découvrir la méthode.</p>
                <Link
                  href="/formations/academy/lecon-0"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
                >
                  Regarder la leçon 0 →
                </Link>
              </div>
            </aside>

            {/* Zone droite : Capsules filtrantes + Grille de cartes */}
            <div className="min-w-0 space-y-5">
              {/* Barre de capsules filtrantes intelligentes */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrer par capsule">
                <SlidersHorizontal size={14} className="mr-1 shrink-0 text-faint" aria-hidden />
                {filtres.map((f) => {
                  const actif = filtre === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => {
                        setFiltre(f.id);
                        setShowAll(false);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                        actif
                          ? 'bg-ivory text-bg font-semibold'
                          : 'border border-border bg-surface text-muted hover:border-border-strong hover:text-ivory'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className={`tabular text-[11px] ${actif ? 'opacity-75' : 'text-faint'}`}>{f.count}</span>
                    </button>
                  );
                })}
              </div>

              {displayedExplorer.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
                  <p className="text-sm font-medium text-ivory">Aucun cours ne correspond à cette sélection.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltre('tous');
                      setQuery('');
                    }}
                    className="mt-3 rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-accent-ink hover:border-accent/40"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {displayedExplorer.map((course) => (
                      <CourseraCourseCard
                        key={course.slug}
                        course={course}
                        recommended={recommandes.has(course.slug)}
                      />
                    ))}
                  </div>
                  {visibleCourses.length > 6 && !showAll && !query.trim() && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-accent-ink transition hover:border-accent/50"
                      >
                        Afficher {visibleCourses.length - 6} autre(s)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── ONGLET EN COURS / TERMINÉS (grille directe) ── */}
      {(tab === 'en_cours' || tab === 'termines') && (
        <section className="space-y-4">
          {visibleCourses.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface px-6 py-10 text-center">
              <p className="text-sm font-medium text-ivory">
                {tab === 'termines'
                  ? 'Aucun parcours terminé à 100 % pour le moment.'
                  : 'Aucun parcours en cours pour le moment.'}
              </p>
              <button
                type="button"
                onClick={() => setTab('explorer')}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-gold-2"
              >
                Explorer le catalogue →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCourses.map((course) => (
                <CourseraCourseCard
                  key={course.slug}
                  course={course}
                  recommended={recommandes.has(course.slug)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── ONGLET CERTIFICATS ── */}
      {tab === 'certificats' && (
        <section aria-label="Examens et certificats par niveau" className="grid gap-4 sm:grid-cols-2">
          {NIVEAUX.map((niv) => {
            const c = courses.find((x) => x.niveau === niv && x.slug.startsWith('academy-niveau-'));
            const cert = certsActifs.find((x) => x.niveau === niv);
            const passed = examensReussis.includes(niv);
            const lessonsOk = c ? c.progress.pct === 100 : false;
            return (
              <div
                key={niv}
                className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-ink">
                      <Award size={14} aria-hidden />
                      {NIVEAU_LABEL[niv]}
                    </span>
                    {cert ? (
                      <span className="rounded-full bg-up/15 px-2.5 py-0.5 text-[11px] font-semibold text-up">
                        Certificat délivré
                      </span>
                    ) : passed ? (
                      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
                        Examen réussi
                      </span>
                    ) : lessonsOk ? (
                      <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-[11px] font-semibold text-warn">
                        Prêt pour l’examen
                      </span>
                    ) : (
                      <span className="rounded-full bg-elevated px-2.5 py-0.5 text-[11px] text-faint">
                        En progression
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-lg text-ivory">
                    {c?.titre ?? `Parcours ${NIVEAU_LABEL[niv]}`}
                  </h3>
                  {c && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted">
                        <span>Leçons validées</span>
                        <span className="tabular">
                          {c.progress.done} / {c.lessonsCount} ({c.progress.pct} %)
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${c.progress.pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2 pt-2">
                  {cert ? (
                    <Link
                      href={`/certificat/${cert.id}`}
                      className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-gold-2"
                    >
                      Voir mon certificat →
                    </Link>
                  ) : passed ? (
                    <Link
                      href={`/formations/academy/certificat?niveau=${niv}`}
                      className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-gold-2"
                    >
                      Générer mon certificat →
                    </Link>
                  ) : lessonsOk ? (
                    <Link
                      href={`/formations/academy/examen/${niv}`}
                      className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent/20"
                    >
                      Passer l’examen →
                    </Link>
                  ) : c ? (
                    <Link
                      href={`/formations/academy/${c.slug}?lecon=${c.progress.nextIdx + 1}`}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-ivory hover:border-accent/40"
                    >
                      Continuer les leçons →
                    </Link>
                  ) : (
                    <span className="text-xs text-faint">Non débloqué dans votre formule</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Leçon 0 mise en avant si on est sur Explorer et que la colonne gauche est déjà visible,
          ou sur Terminés ; Édition intégrale en bas pour les abonnés complets */}
      {complet && (
        <Link
          href="/formations/academy/integrale"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 transition hover:border-accent/30"
        >
          <div>
            <p className="text-sm font-semibold text-ivory">Édition intégrale (44 leçons) · version classique</p>
            <p className="text-xs text-muted">Format de lecture continu regroupant les 4 niveaux.</p>
          </div>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      )}
    </div>
  );
}

function CourseraCourseCard({
  course,
  recommended,
}: {
  course: HubCourseEnriched;
  recommended: boolean;
}) {
  const href = `/formations/academy/${course.slug}${
    course.progress.done > 0 ? `?lecon=${course.progress.nextIdx + 1}` : ''
  }`;
  const visuel = course.niveau ? NIVEAU_VISUEL[course.niveau] : null;
  const nivLabel = course.niveau ? NIVEAU_LABEL[course.niveau as keyof typeof NIVEAU_LABEL] ?? course.niveau : 'Parcours';

  // Priorité aux capsules intelligentes : "Recommandé pour vous" s'ajoute sans dépasser 3 capsules.
  const capsules: { id: string; label: string; ton: 'up' | 'accent' | 'purple' | 'neutre' }[] = [
    ...(recommended
      ? [{ id: 'rec', label: 'Recommandé pour vous', ton: 'purple' as const }]
      : []),
    ...course.capsules,
  ].slice(0, 3);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/50">
      <Link href={href} className="flex flex-1 flex-col">
        {/* Vignette 16:9 */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-elevated">
          {course.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.cover}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className={`flex h-full w-full flex-col justify-between bg-gradient-to-br p-4 ${
                visuel?.accent ?? 'from-accent/15 via-elevated to-surface'
              }`}
            >
              <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-strong bg-bg/70 px-2 py-0.5 text-[11px] font-semibold text-ivory">
                <Compass size={12} aria-hidden className="text-accent-ink" />
                {visuel?.badge ?? 'Cas pratique'}
              </span>
              <p className="line-clamp-2 font-display text-sm font-medium text-ivory/90">{course.titre}</p>
            </div>
          )}

          {course.progress.done > 0 && (
            <span
              className={`tabular absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur ${
                course.progress.pct >= 100 ? 'bg-up/90 text-bg' : 'bg-bg/85 text-ivory border border-border'
              }`}
            >
              {course.progress.pct >= 100 ? (
                <>
                  <Check size={12} strokeWidth={2.5} aria-hidden /> Terminé
                </>
              ) : (
                `${course.progress.pct} %`
              )}
            </span>
          )}
        </div>

        {/* Corps */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-elevated text-[10px] font-bold text-accent-ink">
              WB
            </span>
            <span className="truncate font-medium">WESTBOURSE Academy</span>
          </div>

          <h3 className="mt-2 line-clamp-2 font-display text-base font-semibold leading-snug text-ivory transition-colors group-hover:text-accent-ink">
            {course.titre}
          </h3>

          {course.resume && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{course.resume}</p>}

          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-faint">
            <span>{nivLabel}</span>
            <span aria-hidden>·</span>
            <span className="tabular">{course.lessonsCount} leçons</span>
            {course.totalMinutes > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular inline-flex items-center gap-1">
                  <Clock size={11} aria-hidden />
                  {formatDuree(course.totalMinutes)}
                </span>
              </>
            )}
          </p>

          {/* Capsules intelligentes */}
          {capsules.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {capsules.map((cap) => (
                <span
                  key={cap.id}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight ${capsuleStyle(cap.ton)}`}
                >
                  {cap.label}
                </span>
              ))}
            </div>
          )}

          {/* Pied aligné */}
          <div className="mt-auto pt-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${course.progress.pct}%` }} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-accent-ink">
                {course.progress.pct === 0
                  ? 'Commencer le cours →'
                  : course.progress.pct >= 100
                    ? 'Revoir le cours →'
                    : 'Reprendre →'}
              </span>
              {course.modulesCount > 1 && (
                <span className="tabular inline-flex items-center gap-1 text-faint">
                  <BookOpen size={11} aria-hidden />
                  {course.modulesCount} modules
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {course.niveau && course.progress.pct === 100 && course.slug.startsWith('academy-niveau-') && (
        <div className="border-t border-border/60 bg-elevated/30 px-4 py-2.5">
          <Link
            href={`/formations/academy/examen/${course.niveau}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
          >
            Passer l’examen de certification →
          </Link>
        </div>
      )}
    </article>
  );
}

function CalendrierActiviteCard({
  calendrier,
  weeklyGoal,
  onCycleWeeklyGoal,
}: {
  calendrier: ActiviteCalendrier;
  weeklyGoal: number;
  onCycleWeeklyGoal: () => void;
}) {
  const actifsSet = new Set(calendrier.joursActifs);
  const blanks = Array.from({ length: calendrier.premierJourSemaine });
  const days = Array.from({ length: calendrier.nbJours }, (_, i) => i + 1);

  return (
    <aside className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold capitalize text-ivory">
            <Calendar size={15} className="text-accent-ink" aria-hidden />
            {calendrier.moisLabel}
          </p>
          <button
            type="button"
            onClick={onCycleWeeklyGoal}
            title="Cliquer pour ajuster votre objectif hebdomadaire"
            className="tabular rounded-full border border-border bg-elevated/70 px-2.5 py-0.5 text-[11px] font-medium text-muted hover:border-accent/40 hover:text-ivory"
          >
            Semaine : {calendrier.leconsSemaine}/{weeklyGoal}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-faint">
          {['lu', 'ma', 'me', 'je', 've', 'sa', 'di'].map((d) => (
            <span key={d} className="py-1 font-medium">
              {d}
            </span>
          ))}
          {blanks.map((_, i) => (
            <span key={`b-${i}`} aria-hidden />
          ))}
          {days.map((day) => {
            const active = actifsSet.has(day);
            const today = day === calendrier.jourCourant;
            return (
              <span
                key={day}
                className={`tabular mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  active
                    ? 'bg-accent font-semibold text-bg'
                    : today
                      ? 'border border-accent font-semibold text-accent-ink'
                      : 'text-muted'
                }`}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-3 border-t border-border/60 pt-2.5 text-xs text-muted">
        {calendrier.leconsAujourdhui > 0 ? (
          <>
            <strong className="text-up">✓ {calendrier.leconsAujourdhui}</strong> leçon
            {calendrier.leconsAujourdhui > 1 ? 's' : ''} validée{calendrier.leconsAujourdhui > 1 ? 's' : ''} aujourd’hui.
          </>
        ) : (
          'Validez une leçon aujourd’hui pour allumer la case du jour.'
        )}
      </p>
    </aside>
  );
}
