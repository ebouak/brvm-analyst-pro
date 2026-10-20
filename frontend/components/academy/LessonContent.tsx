'use client';

import type { Lesson, Section } from '@/lib/academy/types';
import { CATEGORIE_LABEL, libelleSection, type Categorie } from '@/lib/academy/types';
import type { PublicExercise } from '@/lib/academy/exercises';
import QcmBlock from './QcmBlock';
import LessonChart from './LessonChart';
import ExerciseBlock from './ExerciseBlock';
import { ChiffresCles, Flux, Formules, Frise, Points, Tableau, Texte } from './lecon/Blocs';
import SimulationLecon from './lecon/Simulations';
import DonneesReelles from './lecon/DonneesReelles';
import type { DonneesSection } from '@/lib/academy/donneesServer';
import './lecon/lecon.css';

/**
 * Leçon Academy rendue comme un article éditorial sur papier clair (`.lp`,
 * lecon/lecon.css) — spec docs/superpowers/specs/2026-10-20-academy-lecon-editoriale-design.md.
 *
 * Aucune section n'est enfermée dans une boîte : la hiérarchie vient de la
 * typographie, de l'espace et des filets. Les blocs facultatifs (formules,
 * schéma, simulation, frise, points) n'apparaissent que si le contenu les porte :
 * une leçon ancienne s'affiche avec son texte, ses chiffres, son tableau et ses
 * étapes, simplement mieux mis en page.
 */

/** Kicker de section : numéro, puis le rôle de la section quand il éclaire la lecture. */
function kicker(s: Section, i: number): string {
  const num = String(i + 1).padStart(2, '0');
  return s.type === 'importance' ? num : `${num} · ${libelleSection(s)}`;
}

function SectionLecon({ s, i, donnees }: { s: Section; i: number; donnees?: DonneesSection | null }) {
  const largeFrise = s.etapes.length > 0 && s.etapes_style === 'frise';
  return (
    <section className={`lp-section lp-large lp-section--${s.type}`} aria-labelledby={`lp-s${i}`}>
      <div className="lp-col">
        <p className="lp-kicker">{kicker(s, i)}</p>
        <h2 id={`lp-s${i}`} className="lp-h2">{s.titre}</h2>
      </div>
      <div className="lp-col lp-corps">
        <Texte contenu={s.contenu} />
      </div>

      {s.flux.length > 0 && (
        <div className="lp-bloc">
          <Flux etapes={s.flux} titre={s.titre} />
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
  /** Exemples réels de cette leçon, par index de section (lus en base au chargement). */
  donnees?: Record<number, DonneesSection | null>;
}) {
  const charts = [lesson.chart, ...(lesson.charts ?? [])].filter((c): c is NonNullable<typeof c> => Boolean(c));
  // Quiz en série s'il existe ; sinon la question unique historique.
  const questions = lesson.quiz?.length ? lesson.quiz : lesson.qcm ? [lesson.qcm] : [];

  return (
    <article className="lp">
      <header className="lp-col">
        <div className="lp-meta">
          <span className="lp-categorie">{CATEGORIE_LABEL[lesson.categorie as Categorie] ?? 'Général'}</span>
          {lesson.duree_min && <span className="lp-duree">{lesson.duree_min} min de lecture</span>}
        </div>
        <h1 className="lp-titre">{lesson.titre}</h1>
        {lesson.sous_titre && <p className="lp-sous-titre">{lesson.sous_titre}</p>}
        <div className="lp-intro">
          <Texte contenu={lesson.resume} />
        </div>
      </header>

      {/* L'illustration vient APRÈS le titre : le titre doit être lu en premier. */}
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
