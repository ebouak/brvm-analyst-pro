'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LearnData, LessonState } from '@/lib/academy/learn';
import { markLessonDone, saveQuizResult, saveNote } from '@/app/formations/academy/actions';
import { courseProgress } from '@/lib/academy/progressCalc';
import LessonContent from './LessonContent';
import ToolsPanel from './ToolsPanel';

/**
 * Shell d'apprentissage type Coursera :
 * sommaire (gauche) · leçon (centre) · outils (droite).
 * Navigation clavier ←/→. Progression optimiste, persistée par server actions.
 */
export default function AcademyShell({
  data,
  initialLesson,
}: {
  data: LearnData;
  initialLesson: number;
}) {
  const lessons = data.content.lessons;
  const clamp = useCallback(
    (i: number) => Math.min(Math.max(0, i), Math.max(0, lessons.length - 1)),
    [lessons.length],
  );
  const [idx, setIdx] = useState(clamp(initialLesson));
  const [progress, setProgress] = useState<Record<number, LessonState>>(data.progress);
  const [showTools, setShowTools] = useState(false); // mobile

  const lesson = lessons[idx]!;
  const p = useMemo(
    () =>
      courseProgress(
        lessons.length,
        Object.entries(progress).map(([k, v]) => ({ lesson_idx: Number(k), completed: v.completed })),
      ),
    [lessons.length, progress],
  );

  const goTo = useCallback(
    (i: number) => {
      const n = clamp(i);
      setIdx(n);
      // URL partageable sans rechargement.
      window.history.replaceState(null, '', `?lecon=${n + 1}`);
      window.scrollTo({ top: 0 });
    },
    [clamp],
  );

  // Navigation clavier ←/→ (hors champs de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) return;
      if (e.key === 'ArrowRight') goTo(idx + 1);
      if (e.key === 'ArrowLeft') goTo(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, goTo]);

  const complete = useCallback(async () => {
    setProgress((prev) => ({
      ...prev,
      [idx]: {
        completed: true,
        quizPassed: prev[idx]?.quizPassed ?? null,
        exercicePassed: prev[idx]?.exercicePassed ?? null,
      },
    }));
    await markLessonDone(data.courseId, idx);
  }, [data.courseId, idx]);

  const onQuizAnswer = useCallback(
    async (correct: boolean) => {
      setProgress((prev) => ({
        ...prev,
        [idx]: {
          completed: prev[idx]?.completed ?? false,
          quizPassed: correct,
          exercicePassed: prev[idx]?.exercicePassed ?? null,
        },
      }));
      await saveQuizResult(data.courseId, idx, correct);
    },
    [data.courseId, idx],
  );

  const onExerciseResult = useCallback(
    (correct: boolean) => {
      // La persistance est faite par checkExercise (serveur) ; on aligne l'état local.
      setProgress((prev) => ({
        ...prev,
        [idx]: {
          completed: prev[idx]?.completed ?? false,
          quizPassed: prev[idx]?.quizPassed ?? null,
          exercicePassed: correct,
        },
      }));
    },
    [idx],
  );

  const onSaveNote = useCallback(
    async (text: string) => {
      await saveNote(data.courseId, idx, text);
    },
    [data.courseId, idx],
  );

  const done = progress[idx]?.completed ?? false;

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Barre de cours ── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <Link href="/formations/academy" className="shrink-0 text-sm text-muted hover:text-white">
            ← Academy
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ivory">{data.content.titre}</p>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${p.pct}%` }} />
            </div>
            <span className="tabular text-xs text-muted">{p.pct}%</span>
          </div>
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-white lg:hidden"
            aria-expanded={showTools}
          >
            Outils
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* ── Sommaire ── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <details className="lg:hidden">
            <summary className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
              Sommaire — leçon {idx + 1}/{lessons.length}
            </summary>
            <Sommaire lessons={lessons} progress={progress} idx={idx} goTo={goTo} />
          </details>
          <div className="hidden lg:block">
            <Sommaire lessons={lessons} progress={progress} idx={idx} goTo={goTo} />
          </div>
        </aside>

        {/* ── Leçon ── */}
        <main className="min-w-0">
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
          />
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
            {!done ? (
              <button
                type="button"
                onClick={complete}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 active:scale-95"
              >
                Marquer terminée
              </button>
            ) : (
              <span className="text-sm text-up">✓ Leçon terminée</span>
            )}
            {idx > 0 && (
              <button type="button" onClick={() => goTo(idx - 1)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-white">
                ← Précédente
              </button>
            )}
            {idx + 1 < lessons.length && (
              <button type="button" onClick={() => goTo(idx + 1)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">
                Leçon suivante →
              </button>
            )}
            <span className="ml-auto hidden text-[11px] text-faint sm:block">← / → au clavier</span>
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

function Sommaire({
  lessons, progress, idx, goTo,
}: {
  lessons: LearnData['content']['lessons'];
  progress: Record<number, LessonState>;
  idx: number;
  goTo: (i: number) => void;
}) {
  return (
    <ol className="mt-2 space-y-1 lg:mt-0">
      {lessons.map((l, i) => {
        const st = progress[i];
        // En-tête de module quand il change (organisation par niveau → modules).
        const showModule = l.module && l.module !== lessons[i - 1]?.module;
        return (
          <li key={i}>
            {showModule && (
              <p className="mb-1 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wide text-faint first:mt-0">
                {l.module}
              </p>
            )}
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === idx}
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                i === idx
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-white'
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  st?.completed ? 'bg-up/20 text-up' : 'border border-border text-faint'
                }`}
              >
                {st?.completed ? '✓' : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{l.titre}</span>
                <span className="text-[10px] text-faint">
                  {l.duree_min ? `${l.duree_min} min` : 'leçon'}
                  {l.qcm ? ' · quiz' : ''}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
