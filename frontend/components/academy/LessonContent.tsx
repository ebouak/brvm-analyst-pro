'use client';

import type { Lesson } from '@/lib/academy/types';
import { SECTION_LABEL, CATEGORIE_LABEL, type Categorie } from '@/lib/academy/types';
import type { PublicExercise } from '@/lib/academy/exercises';
import QcmBlock from './QcmBlock';
import LessonChart from './LessonChart';
import ExerciseBlock from './ExerciseBlock';

/** Styles + icône par type de section — hiérarchie visuelle et repères. */
const SECTION_STYLE: Record<string, { box: string; badge: string; icon: string }> = {
  definition: { box: 'border-accent/30 bg-accent/[0.05]', badge: 'text-accent', icon: '📖' },
  importance: { box: 'border-border bg-surface', badge: 'text-ivory', icon: '💡' },
  cas:        { box: 'border-up/30 bg-up/[0.05]', badge: 'text-up', icon: '🔍' },
  piege:      { box: 'border-down/30 bg-down/[0.05]', badge: 'text-down', icon: '⚠️' },
  lexique:    { box: 'border-border bg-surface', badge: 'text-muted', icon: '📚' },
  retenir:    { box: 'border-gold/30 bg-gold/[0.06]', badge: 'text-gold', icon: '✅' },
};

export default function LessonContent({
  lesson,
  quizPassed,
  onQuizAnswer,
  exercise,
  exercicePassed,
  courseId,
  lessonIdx,
  onExerciseResult,
}: {
  lesson: Lesson;
  quizPassed: boolean | null;
  onQuizAnswer: (correct: boolean) => void;
  exercise?: PublicExercise;
  exercicePassed: boolean | null;
  courseId: string;
  lessonIdx: number;
  onExerciseResult: (correct: boolean) => void;
}) {
  return (
    <article className="space-y-5">
      {/* Bandeau image (illustration thématique) */}
      {lesson.image?.url && (
        <figure className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lesson.image.url}
            alt={lesson.image.alt || lesson.titre}
            className="h-48 w-full object-cover sm:h-60"
            loading="lazy"
          />
          {lesson.image.credit && (
            <figcaption className="bg-surface px-3 py-1 text-right text-[10px] text-faint">
              {lesson.image.credit} · illustration
            </figcaption>
          )}
        </figure>
      )}

      <header>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            {CATEGORIE_LABEL[lesson.categorie as Categorie] ?? 'Général'}
          </span>
          {lesson.duree_min && (
            <span className="text-[11px] text-faint">⏱ {lesson.duree_min} min de lecture</span>
          )}
        </div>
        <h1 className="font-display text-2xl text-white">{lesson.titre}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{lesson.resume}</p>
      </header>

      {lesson.sections.map((s, i) => {
        const st = SECTION_STYLE[s.type] ?? SECTION_STYLE.importance!;
        return (
          <section key={i} className={`rounded-xl border p-4 ${st.box}`}>
            <p className={`overline mb-1.5 flex items-center gap-1.5 ${st.badge}`}>
              <span aria-hidden>{st.icon}</span>
              {SECTION_LABEL[s.type] ?? s.titre}
            </p>
            <h2 className="text-sm font-semibold text-ivory">{s.titre}</h2>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">{s.contenu}</p>
          </section>
        );
      })}

      {lesson.chart && <LessonChart chart={lesson.chart} />}
      {lesson.charts?.map((c, i) => <LessonChart key={`c${i}`} chart={c} />)}

      {exercise && (
        <ExerciseBlock
          exercise={exercise}
          courseId={courseId}
          lessonIdx={lessonIdx}
          alreadyPassed={exercicePassed}
          onResult={onExerciseResult}
        />
      )}

      {lesson.qcm && (
        <QcmBlock qcm={lesson.qcm} alreadyPassed={quizPassed} onAnswer={onQuizAnswer} />
      )}
    </article>
  );
}
