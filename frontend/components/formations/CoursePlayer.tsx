'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { saveLessonProgress } from '@/app/formations/modules/actions';
import type { CourseDetail, VideoLesson, VideoQuiz } from '@/lib/video/server';

/** Lecteur de cours vidéo : nav des leçons + vidéo + chapitres + quiz + progression. */
export default function CoursePlayer({ course }: { course: CourseDetail }) {
  const [lessons, setLessons] = useState<VideoLesson[]>(course.lessons);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = lessons[activeIdx];

  const nbDone = lessons.filter((l) => l.completed).length;
  const pct = lessons.length ? Math.round((nbDone / lessons.length) * 100) : 0;

  const markCompleted = useCallback((lessonId: string) => {
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, completed: true } : l)));
  }, []);

  if (!active) {
    return <p className="text-sm text-muted">Ce cours n’a pas encore de leçon.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* ── Sommaire des leçons ── */}
      <aside className="space-y-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>Progression</span>
            <span className="tabular text-ivory">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-faint">{nbDone}/{lessons.length} leçons terminées</p>
        </div>

        <ol className="space-y-1">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-current={i === activeIdx}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  i === activeIdx
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-white'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    l.completed ? 'bg-up/20 text-up' : 'border border-border text-faint'
                  }`}
                >
                  {l.completed ? '✓' : i + 1}
                </span>
                <span className="min-w-0 truncate">{l.titre}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* ── Leçon active ── */}
      <div className="min-w-0 space-y-5">
        <LessonView
          key={active.id}
          lesson={active}
          onCompleted={() => markCompleted(active.id)}
          onNext={activeIdx + 1 < lessons.length ? () => setActiveIdx(activeIdx + 1) : undefined}
        />
      </div>
    </div>
  );
}

function LessonView({
  lesson, onCompleted, onNext,
}: {
  lesson: VideoLesson;
  onCompleted: () => void;
  onNext?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [chapterStart, setChapterStart] = useState(lesson.last_second || 0);
  const [done, setDone] = useState(lesson.completed);
  const lastSaved = useRef(0);

  // MP4 : reprise + sauvegarde throttlée de la position.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || lesson.provider !== 'mp4') return;
    if (lesson.last_second > 0) v.currentTime = lesson.last_second;
    const onTime = () => {
      const t = Math.floor(v.currentTime);
      if (t - lastSaved.current >= 10) {
        lastSaved.current = t;
        void saveLessonProgress(lesson.id, { lastSecond: t });
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [lesson.id, lesson.provider, lesson.last_second]);

  const complete = useCallback(async () => {
    setDone(true);
    onCompleted();
    await saveLessonProgress(lesson.id, { completed: true });
  }, [lesson.id, onCompleted]);

  const seekTo = useCallback((s: number) => {
    if (lesson.provider === 'mp4' && videoRef.current) {
      videoRef.current.currentTime = s;
      void videoRef.current.play();
    } else {
      setChapterStart(s); // recharge l'iframe avec ?start=
    }
  }, [lesson.provider]);

  const embedSrc = useMemo(() => {
    if (lesson.provider === 'youtube') {
      return `https://www.youtube.com/embed/${lesson.video_url}?start=${chapterStart}&rel=0`;
    }
    if (lesson.provider === 'vimeo') {
      return `https://player.vimeo.com/video/${lesson.video_url}#t=${chapterStart}s`;
    }
    return '';
  }, [lesson.provider, lesson.video_url, chapterStart]);

  return (
    <>
      <div>
        <h2 className="font-display text-xl text-white">{lesson.titre}</h2>
        {done && <span className="mt-1 inline-block rounded-full bg-up/15 px-2 py-0.5 text-[11px] font-medium text-up">Terminée</span>}
      </div>

      {/* Lecteur */}
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <div className="relative aspect-video">
          {lesson.provider === 'mp4' ? (
            <video ref={videoRef} src={lesson.video_url} controls className="h-full w-full" onEnded={complete} />
          ) : (
            <iframe
              src={embedSrc}
              title={lesson.titre}
              className="h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
      </div>

      {/* Chapitres */}
      {lesson.chapters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lesson.chapters.map((c) => (
            <button
              key={`${c.at_s}-${c.titre}`}
              type="button"
              onClick={() => seekTo(c.at_s)}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-white"
            >
              <span className="tabular text-faint">{fmtTime(c.at_s)}</span> · {c.titre}
            </button>
          ))}
        </div>
      )}

      {/* Quiz */}
      {lesson.quizzes.map((q) => (
        <Quiz key={q.id} quiz={q} />
      ))}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
        {!done ? (
          <button
            type="button"
            onClick={complete}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 active:scale-95"
          >
            Marquer comme terminée
          </button>
        ) : (
          <span className="text-sm text-up">✓ Leçon terminée</span>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white"
          >
            Leçon suivante →
          </button>
        )}
      </div>
    </>
  );
}

function Quiz({ quiz }: { quiz: VideoQuiz }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === quiz.correct_idx;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ivory">Quiz — {quiz.question}</p>
      <div className="mt-3 space-y-2">
        {quiz.options.map((opt, i) => {
          const isCorrect = answered && i === quiz.correct_idx;
          const isWrongPick = answered && i === picked && !correct;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setPicked(i)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${
                isCorrect
                  ? 'border-up/50 bg-up/10 text-up'
                  : isWrongPick
                    ? 'border-down/50 bg-down/10 text-down'
                    : 'border-border bg-bg text-muted hover:border-accent/40 hover:text-white'
              }`}
            >
              <span aria-hidden className="text-xs text-faint">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
              {isCorrect && <span className="ml-auto">✓</span>}
              {isWrongPick && <span className="ml-auto">✗</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`mt-3 text-xs ${correct ? 'text-up' : 'text-muted'}`}>
          {correct ? 'Bonne réponse ! ' : 'La bonne réponse est surlignée. '}
          {quiz.explication}
        </p>
      )}
    </div>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
