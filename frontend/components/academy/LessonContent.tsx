'use client';

import type { Lesson } from '@/lib/academy/types';
import { SECTION_LABEL } from '@/lib/academy/types';
import QcmBlock from './QcmBlock';
import LessonChart from './LessonChart';

/** Styles par type de section — hiérarchie visuelle du manuel. */
const SECTION_STYLE: Record<string, { box: string; badge: string }> = {
  definition: { box: 'border-accent/30 bg-accent/[0.05]', badge: 'text-accent' },
  importance: { box: 'border-border bg-surface', badge: 'text-ivory' },
  cas:        { box: 'border-up/30 bg-up/[0.05]', badge: 'text-up' },
  piege:      { box: 'border-down/30 bg-down/[0.05]', badge: 'text-down' },
  lexique:    { box: 'border-border bg-surface', badge: 'text-muted' },
  retenir:    { box: 'border-gold/30 bg-gold/[0.06]', badge: 'text-gold' },
};

export default function LessonContent({
  lesson,
  quizPassed,
  onQuizAnswer,
}: {
  lesson: Lesson;
  quizPassed: boolean | null;
  onQuizAnswer: (correct: boolean) => void;
}) {
  return (
    <article className="space-y-5">
      <header>
        <h1 className="font-display text-2xl text-white">{lesson.titre}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{lesson.resume}</p>
      </header>

      {lesson.image?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lesson.image.url}
          alt={lesson.image.alt || lesson.titre}
          className="max-h-64 w-full rounded-xl border border-border object-cover"
          loading="lazy"
        />
      )}

      {lesson.sections.map((s, i) => {
        const st = SECTION_STYLE[s.type] ?? SECTION_STYLE.importance!;
        return (
          <section key={i} className={`rounded-xl border p-4 ${st.box}`}>
            <p className={`overline mb-1.5 ${st.badge}`}>{SECTION_LABEL[s.type] ?? s.titre}</p>
            <h2 className="text-sm font-semibold text-ivory">{s.titre}</h2>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">{s.contenu}</p>
          </section>
        );
      })}

      {lesson.chart && <LessonChart chart={lesson.chart} />}

      {lesson.qcm && (
        <QcmBlock qcm={lesson.qcm} alreadyPassed={quizPassed} onAnswer={onQuizAnswer} />
      )}
    </article>
  );
}
