'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lesson, Section } from '@/lib/academy/types';
import { CATEGORIE_LABEL, libelleSection, type Categorie } from '@/lib/academy/types';
import type { PublicExercise } from '@/lib/academy/exercises';
import QcmBlock from './QcmBlock';
import LessonChart from './LessonChart';
import ExerciseBlock from './ExerciseBlock';
import { ChiffresCles, Encadres, Flux, Formules, Frise, Points, Tableau, Texte } from './lecon/Blocs';
import { badgeNouveaute } from '@/lib/academy/nouveaute';
import SimulationLecon from './lecon/Simulations';
import DonneesReelles from './lecon/DonneesReelles';
import Illustration from './lecon/Illustration';
import type { DonneesSection } from '@/lib/academy/donneesServer';
import './lecon/lecon.css';

function role(s: Section): string | null {
  if (s.type === 'piege' || s.type === 'retenir' || (s.type === 'cas' && s.reel)) return libelleSection(s);
  return null;
}

function SectionLecon({ s, i, donnees }: { s: Section; i: number; donnees?: DonneesSection | null }) {
  const largeFrise = s.etapes.length > 0 && s.etapes_style === 'frise';
  return (
    <section className={`lp-section lp-large lp-section--${s.type}`} aria-labelledby={`lp-s${i}`}>
      <div className="lp-col">
        <h2 id={`lp-s${i}`} className="lp-h2">
          {s.titre}
          {role(s) && <span className="lp-role">{role(s)}</span>}
        </h2>
      </div>
      <div className="lp-col lp-corps">
        <Texte contenu={s.contenu} />
      </div>

      {s.flux.length > 0 && (
        <div className="lp-bloc">
          <Flux etapes={s.flux} titre={s.titre} />
        </div>
      )}
      {s.illustration && (
        <div className="lp-bloc lp-large">
          <Illustration illustration={s.illustration} />
        </div>
      )}
      {s.formules.length > 0 && (
        <div className="lp-bloc lp-col">
          <Formules formules={s.formules} />
        </div>
      )}
      {s.stats.length > 0 && (
        <div className="lp-bloc lp-col">
          <ChiffresCles stats={s.stats} />
        </div>
      )}
      {s.simulation && (
        <div className="lp-bloc">
          <SimulationLecon sim={s.simulation} />
        </div>
      )}
      {s.simulations.map((sm, k) => (
        <div key={k} className="lp-bloc">
          <SimulationLecon sim={sm} />
        </div>
      ))}
      {s.donnees_reelles && (
        <div className="lp-bloc">
          <DonneesReelles donnees={donnees} />
        </div>
      )}
      {s.tableau && (
        <div className="lp-bloc lp-col">
          <Tableau tableau={s.tableau} />
        </div>
      )}
      {s.tableaux.map((t, k) => (
        <div key={`t${k}`} className="lp-bloc lp-col">
          <Tableau tableau={t} />
        </div>
      ))}
      {s.graphiques.map((g, k) => (
        <div key={`g${k}`} className="lp-bloc">
          <LessonChart chart={g} variant="slide" />
        </div>
      ))}
      {s.etapes.length > 0 && (
        <div className={`lp-bloc ${largeFrise ? 'lp-large' : 'lp-col'}`}>
          <Frise etapes={s.etapes} style={s.etapes_style} />
        </div>
      )}
      {s.points.length > 0 && (
        <div className="lp-bloc lp-col lp-corps">
          <Points points={s.points} />
        </div>
      )}
      {s.encadres.length > 0 && (
        <div className="lp-bloc lp-col">
          <Encadres encadres={s.encadres} />
        </div>
      )}
    </section>
  );
}

export default function LessonContent({
  lesson,
  quizPassed,
  onQuizAnswer,
  exercise,
  exercicePassed,
  courseId,
  lessonIdx,
  onExerciseResult,
  donnees,
}: {
  lesson: Lesson;
  quizPassed: boolean | null;
  onQuizAnswer: (correct: boolean) => void;
  exercise?: PublicExercise;
  exercicePassed: boolean | null;
  courseId: string;
  lessonIdx: number;
  onExerciseResult: (correct: boolean) => void;
  donnees?: Record<number, DonneesSection | null>;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight * 0.75;
      if (total <= 0) {
        setScrollPct(100);
        return;
      }
      const passed = -rect.top;
      setScrollPct(Math.min(100, Math.max(0, Math.round((passed / total) * 100))));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const charts = [lesson.chart, ...(lesson.charts ?? [])].filter((c): c is NonNullable<typeof c> => Boolean(c));
  const questions = lesson.quiz?.length ? lesson.quiz : lesson.qcm ? [lesson.qcm] : [];
  const badge = badgeNouveaute(lesson.nouveaute, new Date());
  const showAncres = lesson.sections.length >= 4;

  return (
    <article ref={articleRef} className="lp">
      <div className="lp-progress-wrap" aria-hidden="true">
        <div className="lp-progress-fill" style={{ width: `${scrollPct}%` }} />
      </div>

      <header className="lp-col">
        <div className="lp-meta">
          <span className="lp-categorie">{CATEGORIE_LABEL[lesson.categorie as Categorie] ?? 'Général'}</span>
          {lesson.duree_min && <span className="lp-duree">{lesson.duree_min} min de lecture</span>}
          {badge && <span className={`lp-nouveaute lp-nouveaute--${badge.type}`}>{badge.libelle}</span>}
        </div>
        <h1 className="lp-titre">{lesson.titre}</h1>
        {lesson.sous_titre && <p className="lp-sous-titre">{lesson.sous_titre}</p>}
        <div className="lp-intro">
          <Texte contenu={lesson.resume} />
        </div>

        {showAncres && (
          <nav aria-label="Plan de la leçon" className="lp-ancres">
            {lesson.sections.map((s, i) => {
              const hasSim = Boolean(s.simulation) || s.simulations.length > 0;
              return (
                <a
                  key={i}
                  href={`#lp-s${i}`}
                  className={`lp-ancre${hasSim ? ' lp-ancre--sim' : ''}`}
                >
                  {s.titre}
                </a>
              );
            })}
            {questions.length > 0 && (
              <a href="#lp-quiz-titre" className="lp-ancre lp-ancre--quiz">
                Quiz · {questions.length} Q
              </a>
            )}
          </nav>
        )}
      </header>

      {lesson.image?.url && (
        <figure className="lp-image lp-large">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lesson.image.url} alt={lesson.image.alt || ''} loading="lazy" />
          {lesson.image.credit && <figcaption>{lesson.image.credit} · illustration</figcaption>}
        </figure>
      )}

      {lesson.sections.map((s, i) => (
        <SectionLecon key={i} s={s} i={i} donnees={donnees?.[i]} />
      ))}

      {charts.length > 0 && (
        <div className="lp-section lp-large">
          {charts.map((c, i) => (
            <div key={i} className={i > 0 ? 'lp-bloc' : undefined}>
              <LessonChart chart={c} variant="slide" />
            </div>
          ))}
        </div>
      )}

      {exercise && (
        <div className="lp-exercice lp-col">
          <ExerciseBlock
            exercise={exercise}
            courseId={courseId}
            lessonIdx={lessonIdx}
            alreadyPassed={exercicePassed}
            onResult={onExerciseResult}
          />
        </div>
      )}

      {questions.length > 0 && <QcmBlock questions={questions} alreadyPassed={quizPassed} onAnswer={onQuizAnswer} />}

      {lesson.avertissement && <p className="lp-avertissement lp-col">{lesson.avertissement}</p>}
    </article>
  );
}
