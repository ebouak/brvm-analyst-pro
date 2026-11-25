'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, ChevronDown, Compass, Layers, Lock, Target } from 'lucide-react';
import type { LearnData, LessonState } from '@/lib/academy/learn';
import { markLessonDone, saveQuizResult, saveNote } from '@/app/formations/academy/actions';
import { courseProgress } from '@/lib/academy/progressCalc';
import { extraireCapsulesLecon, formatDuree, type LessonLike } from '@/lib/academy/capsules';
import { badgeEnsemble, badgeNouveaute } from '@/lib/academy/nouveaute';
import LessonContent from './LessonContent';
import ToolsPanel from './ToolsPanel';
import SlideDeck from './SlideDeck';
import FicheRevision from './FicheRevision';
import LessonVideo from './LessonVideo';
import BadgeNouveaute from './BadgeNouveaute';

const DAILY_GOAL_KEY = 'wb_academy_daily_goal';
const DAILY_OPTIONS = [1, 2, 3] as const;

/**
 * Shell d'apprentissage type Coursera :
 * objectif du jour + modules dépliables à capsules (gauche) · leçon (centre) · outils (droite).
 * Supporte `freeTrial` pour la Leçon 1 du Niveau 1 ouverte à tous.
 */
export default function AcademyShell({
  data,
  initialLesson,
  videos = [],
  niveau = null,
  freeTrial = false,
}: {
  data: LearnData;
  initialLesson: number;
  videos?: number[];
  niveau?: string | null;
  freeTrial?: boolean;
}) {
  const lessons = data.content.lessons;
  const clamp = useCallback(
    (i: number) => Math.min(Math.max(0, i), Math.max(0, lessons.length - 1)),
    [lessons.length],
  );
  const [idx, setIdx] = useState(clamp(initialLesson));
  const [progress, setProgress] = useState<Record<number, LessonState>>(data.progress);
  const [showTools, setShowTools] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(2);
  const [autoValidated, setAutoValidated] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(DAILY_GOAL_KEY));
      if (DAILY_OPTIONS.includes(saved as 1 | 2 | 3)) setDailyGoal(saved);
    } catch {
      // ignorer
    }
  }, []);

  const cycleDailyGoal = () => {
    const next = DAILY_OPTIONS[(DAILY_OPTIONS.indexOf(dailyGoal as 1 | 2 | 3) + 1) % DAILY_OPTIONS.length] ?? 2;
    setDailyGoal(next);
    try {
      window.localStorage.setItem(DAILY_GOAL_KEY, String(next));
    } catch {
      // ignorer
    }
  };

  const lesson = lessons[idx]!;
  const p = useMemo(
    () =>
      courseProgress(
        lessons.length,
        Object.entries(progress).map(([k, v]) => ({ lesson_idx: Number(k), completed: v.completed })),
      ),
    [lessons.length, progress],
  );

  const todayCount = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return Object.values(progress).filter(
      (st) => st.completed && st.updatedAt && st.updatedAt.slice(0, 10) === todayPrefix,
    ).length;
  }, [progress]);

  const goTo = useCallback(
    (i: number) => {
      if (freeTrial && i > 0) return;
      const n = clamp(i);
      setIdx(n);
      setAutoValidated(false);
      window.history.replaceState(null, '', `?lecon=${n + 1}`);
      window.scrollTo({ top: 0 });
    },
    [clamp, freeTrial],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) return;
      if (e.key === 'ArrowRight' && !freeTrial) goTo(idx + 1);
      if (e.key === 'ArrowLeft' && !freeTrial) goTo(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, goTo, freeTrial]);

  const complete = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setProgress((prev) => ({
      ...prev,
      [idx]: {
        completed: true,
        quizPassed: prev[idx]?.quizPassed ?? null,
        exercicePassed: prev[idx]?.exercicePassed ?? null,
        updatedAt: nowIso,
      },
    }));
    if (!freeTrial) await markLessonDone(data.courseId, idx);
  }, [data.courseId, idx, freeTrial]);

  const onQuizAnswer = useCallback(
    async (correct: boolean) => {
      const wasCompleted = progress[idx]?.completed ?? false;
      const shouldAutoComplete = correct && !wasCompleted;
      const nowIso = new Date().toISOString();
      setProgress((prev) => ({
        ...prev,
        [idx]: {
          completed: prev[idx]?.completed || shouldAutoComplete,
          quizPassed: correct,
          exercicePassed: prev[idx]?.exercicePassed ?? null,
          updatedAt: shouldAutoComplete ? nowIso : prev[idx]?.updatedAt ?? null,
        },
      }));
      if (shouldAutoComplete) setAutoValidated(true);
      if (!freeTrial) {
        await saveQuizResult(data.courseId, idx, correct);
        if (shouldAutoComplete) await markLessonDone(data.courseId, idx);
      }
    },
    [data.courseId, idx, progress, freeTrial],
  );

  const onExerciseResult = useCallback(
    (correct: boolean) => {
      setProgress((prev) => ({
        ...prev,
        [idx]: {
          completed: prev[idx]?.completed ?? false,
          quizPassed: prev[idx]?.quizPassed ?? null,
          exercicePassed: correct,
          updatedAt: prev[idx]?.updatedAt ?? null,
        },
      }));
    },
    [idx],
  );

  const onSaveNote = useCallback(
    async (text: string) => {
      if (!freeTrial) await saveNote(data.courseId, idx, text);
    },
    [data.courseId, idx, freeTrial],
  );

  const done = progress[idx]?.completed ?? false;

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Barre de cours ── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Link href="/formations/academy" className="shrink-0 text-sm text-muted hover:text-ivory">
            ← Academy
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ivory">{data.content.titre}</p>
          {!freeTrial && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${p.pct}%` }} />
              </div>
              <span className="tabular text-xs text-muted">{p.pct}%</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowRevision(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated/60 px-2.5 py-1 text-xs font-medium text-ivory transition hover:border-accent/50"
            title="Flashcards et fiche mémo PDF de ce cours"
          >
            <Layers size={13} aria-hidden className="text-accent-ink" />
            <span className="hidden sm:inline">Révision & Flashcards</span>
            <span className="sm:hidden">Mémo</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDeck(true)}
            className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold transition hover:bg-gold/20"
            title="Voir le cours en diapositives"
          >
            <span className="hidden sm:inline">Mode présentation</span>
            <span className="sm:hidden">Diapos</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-ivory lg:hidden"
            aria-expanded={showTools}
          >
            Outils
          </button>
        </div>
      </header>

      {showDeck && <SlideDeck content={data.content} onClose={() => setShowDeck(false)} />}
      {showRevision && <FicheRevision content={data.content} onClose={() => setShowRevision(false)} />}

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* ── Sommaire + Objectif du jour ── */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          {!freeTrial ? (
            <ObjectifDuJourCard count={todayCount} target={dailyGoal} onCycleTarget={cycleDailyGoal} />
          ) : (
            <div className="rounded-xl border border-up/35 bg-up/10 p-3.5 text-xs">
              <p className="font-semibold text-up">Essai libre · Leçon 1 offerte</p>
              <p className="mt-1 leading-relaxed text-muted">
                Manipulez les graphiques réels, le simulateur et le quiz librement.
              </p>
              <Link
                href={`/formations/academy/${data.slug}?lecon=2`}
                className="mt-2 inline-block font-semibold text-accent-ink hover:underline"
              >
                Débloquer les {lessons.length} leçons →
              </Link>
            </div>
          )}

          <details className="lg:hidden">
            <summary className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
              Sommaire · leçon {idx + 1}/{lessons.length}
            </summary>
            <div className="mt-2">
              <Sommaire
                slug={data.slug}
                lessons={lessons}
                progress={progress}
                idx={idx}
                goTo={goTo}
                videos={videos}
                freeTrial={freeTrial}
              />
            </div>
          </details>
          <div className="hidden lg:block lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
            <Sommaire
              slug={data.slug}
              lessons={lessons}
              progress={progress}
              idx={idx}
              goTo={goTo}
              videos={videos}
              freeTrial={freeTrial}
            />
          </div>
        </aside>

        {/* ── Leçon ── */}
        <main className="min-w-0">
          {freeTrial && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/35 bg-accent/[0.06] px-4 py-3 text-xs">
              <span className="text-ivory">
                <strong className="text-up">Leçon 1 offerte</strong> — accès complet sans abonnement pour tester la
                méthode WESTBOURSE.
              </span>
              <Link
                href={`/formations/academy/${data.slug}?lecon=2`}
                className="font-semibold text-accent-ink hover:underline"
              >
                Voir les offres du niveau →
              </Link>
            </div>
          )}

          {videos.includes(idx + 1) && <LessonVideo key={`video-${idx}`} slug={data.slug} numero={idx + 1} />}
          <LessonContent
            key={idx}
            lesson={lesson}
            quizPassed={progress[idx]?.quizPassed ?? null}
            onQuizAnswer={onQuizAnswer}
            exercise={data.exercises[idx]}
            exercicePassed={progress[idx]?.exercicePassed ?? null}
            courseId={data.courseId}
            lessonIdx={idx}
            onExerciseResult={onExerciseResult}
            donnees={data.donnees[idx]}
          />

          {/* Pont direct Academy -> Plateforme WESTBOURSE */}
          {lesson.liens && lesson.liens.length > 0 && (
            <section
              aria-label="Passer à la pratique sur WESTBOURSE"
              className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-ink">
                <Compass size={14} aria-hidden />
                Passer à la pratique sur WESTBOURSE
              </p>
              <p className="mt-1 text-xs text-muted">
                Appliquez immédiatement cette leçon avec les outils réels de la plateforme :
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lesson.liens.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-bg/60 px-3 py-2 text-xs font-medium text-ivory transition hover:border-accent/50 hover:text-accent-ink"
                  >
                    <span>{l.label}</span>
                    <ArrowUpRight size={13} aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
            {!freeTrial && !done ? (
              <button
                type="button"
                onClick={complete}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 active:scale-95"
              >
                Marquer terminée
              </button>
            ) : !freeTrial && done ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-up">
                <Check size={15} strokeWidth={2.5} aria-hidden />
                {autoValidated ? 'Quiz réussi · leçon validée' : 'Terminé'}
              </span>
            ) : null}

            {!freeTrial && idx > 0 && (
              <button
                type="button"
                onClick={() => goTo(idx - 1)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-ivory"
              >
                ← Précédente
              </button>
            )}

            {freeTrial ? (
              <Link
                href={`/formations/academy/${data.slug}?lecon=2`}
                className="ml-auto rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2"
              >
                Débloquer la Leçon 2 et la suite →
              </Link>
            ) : idx + 1 < lessons.length ? (
              <button
                type="button"
                onClick={() => goTo(idx + 1)}
                className={
                  done
                    ? 'ml-auto rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 active:scale-95'
                    : 'rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-ivory'
                }
              >
                Aller à l’élément suivant →
              </button>
            ) : null}

            {!freeTrial && niveau && p.pct === 100 && (
              <Link
                href={`/formations/academy/examen/${niveau}`}
                className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/20"
              >
                Passer l’examen →
              </Link>
            )}
            {!freeTrial && <span className="hidden text-[11px] text-faint sm:block">← / → au clavier</span>}
          </div>
        </main>

        {/* ── Outils ── */}
        <aside className={`${showTools ? 'block' : 'hidden'} lg:sticky lg:top-20 lg:block lg:self-start`}>
          <ToolsPanel
            key={idx}
            lesson={lesson}
            content={data.content}
            note={data.notes[idx] ?? ''}
            onSaveNote={onSaveNote}
          />
        </aside>
      </div>
    </div>
  );
}

function ObjectifDuJourCard({
  count,
  target,
  onCycleTarget,
}: {
  count: number;
  target: number;
  onCycleTarget: () => void;
}) {
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
  const atteint = count >= target;
  return (
    <details open className="rounded-xl border border-border bg-surface p-3.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-ivory">
          <Target size={14} className={atteint ? 'text-up' : 'text-accent-ink'} aria-hidden />
          <span className="tabular">
            Objectif du jour · {count} élément{count > 1 ? 's' : ''} sur {target}
          </span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-faint" aria-hidden />
      </summary>
      <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all ${atteint ? 'bg-up' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span>
            {atteint
              ? 'Objectif atteint pour aujourd’hui.'
              : `Validez ${target - count} leçon${target - count > 1 ? 's' : ''} aujourd’hui pour garder le rythme.`}
          </span>
          <button
            type="button"
            onClick={onCycleTarget}
            className="shrink-0 font-medium text-accent-ink hover:underline"
          >
            Régler ({target})
          </button>
        </div>
      </div>
    </details>
  );
}

function Sommaire({
  slug,
  lessons,
  progress,
  idx,
  goTo,
  videos,
  freeTrial,
}: {
  slug: string;
  lessons: LearnData['content']['lessons'];
  progress: Record<number, LessonState>;
  idx: number;
  goTo: (i: number) => void;
  videos: number[];
  freeTrial: boolean;
}) {
  const maintenant = new Date();
  const hasModules = lessons.some((l) => Boolean(l.module));

  const groupes = lessons.reduce<
    { nom: string; items: { lesson: LearnData['content']['lessons'][number]; i: number }[] }[]
  >((acc, lesson, i) => {
    const nom = hasModules ? lesson.module ?? 'Autres leçons' : 'Leçons du cours';
    const last = acc[acc.length - 1];
    if (last && last.nom === nom) last.items.push({ lesson, i });
    else acc.push({ nom, items: [{ lesson, i }] });
    return acc;
  }, []);

  return (
    <div className="space-y-2">
      {groupes.map((g) => {
        const contientActive = g.items.some(({ i }) => i === idx);
        const doneInGroup = g.items.filter(({ i }) => progress[i]?.completed).length;
        const minsInGroup = g.items.reduce((s, { lesson }) => s + (lesson.duree_min ?? 0), 0);
        const badgeModule = badgeEnsemble(
          g.items.map(({ lesson }) => lesson),
          maintenant,
        );

        return (
          <details
            key={g.nom}
            open={contientActive || groupes.length === 1}
            className="group/mod rounded-xl border border-border bg-surface/60"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ivory">
                  <span>{g.nom}</span>
                  {badgeModule && <BadgeNouveaute badge={badgeModule} />}
                </p>
                <p className="tabular mt-0.5 text-[11px] text-faint">
                  {doneInGroup}/{g.items.length} terminées
                  {minsInGroup > 0 ? ` · ${formatDuree(minsInGroup)}` : ''}
                </p>
              </div>
              <ChevronDown
                size={14}
                aria-hidden
                className="mt-0.5 shrink-0 text-faint transition-transform group-open/mod:rotate-180"
              />
            </summary>

            <ol className="space-y-1 border-t border-border/50 p-1.5">
              {g.items.map(({ lesson: l, i }) => {
                const st = progress[i];
                const badge = badgeNouveaute(l.nouveaute, maintenant);
                const caps = extraireCapsulesLecon(l as LessonLike, { hasVideo: videos.includes(i + 1) }).slice(0, 3);
                const current = i === idx;
                const locked = freeTrial && i > 0;

                const inner = (
                  <>
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                        st?.completed
                          ? 'bg-up/20 text-up'
                          : current
                            ? 'border border-accent text-accent-ink'
                            : 'border border-border text-faint'
                      }`}
                    >
                      {locked ? (
                        <Lock size={11} aria-label="Verrouillée" />
                      ) : st?.completed ? (
                        <Check size={13} strokeWidth={2.5} aria-label="Terminée" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[13px] font-medium leading-snug">{l.titre}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-faint">
                        {caps.map((cap, k) => (
                          <span key={k} className="rounded bg-elevated/80 px-1.5 py-0.5 text-muted">
                            {cap.label}
                          </span>
                        ))}
                        {badge && <BadgeNouveaute badge={badge} />}
                      </span>
                    </span>
                  </>
                );

                const itemClass = `flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  current
                    ? 'border border-accent/60 bg-accent/10 text-ivory'
                    : 'border border-transparent text-muted hover:bg-elevated/50 hover:text-ivory'
                }`;

                return (
                  <li key={i}>
                    {locked ? (
                      <Link href={`/formations/academy/${slug}?lecon=${i + 1}`} className={itemClass}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => goTo(i)} aria-current={current} className={itemClass}>
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
