'use client';

import { useState } from 'react';
import type { Qcm } from '@/lib/academy/types';

/** Même seuil que les examens de niveau : 70 %. */
const SEUIL = 0.7;

/**
 * Quiz d'une leçon : une ou plusieurs questions, sur la surface de lecture
 * claire `.lp` (components/academy/lecon/lecon.css). Chaque question se répond
 * une fois et montre son explication ; quand toutes ont une réponse, le score
 * s'affiche et le parent enregistre la réussite (onAnswer) — une seule fois par
 * passage. « Recommencer » permet de rejouer.
 */
export default function QcmBlock({
  questions,
  alreadyPassed,
  onAnswer,
}: {
  questions: Qcm[];
  alreadyPassed: boolean | null;
  onAnswer: (passed: boolean) => void;
}) {
  const [reponses, setReponses] = useState<(number | null)[]>(() => questions.map(() => null));
  const total = questions.length;
  const repondues = reponses.filter((r) => r !== null).length;
  const justes = reponses.filter((r, i) => r !== null && r === questions[i]!.correct).length;
  const requis = Math.ceil(total * SEUIL);
  const fini = repondues === total;

  const choisir = (q: number, i: number) => {
    if (reponses[q] !== null) return;
    const suivantes = reponses.map((r, j) => (j === q ? i : r));
    setReponses(suivantes);
    if (suivantes.every((r) => r !== null)) {
      const score = suivantes.filter((r, j) => r === questions[j]!.correct).length;
      onAnswer(score >= requis);
    }
  };

  return (
    <section className="lp-quiz" aria-labelledby="lp-quiz-titre">
      <div className="lp-col">
        <p className="lp-kicker" id="lp-quiz-titre">
          Quiz · {total} question{total > 1 ? 's' : ''}
          {alreadyPassed && !fini && <span className="lp-quiz-deja"> · déjà réussi ✓</span>}
        </p>
        <ol className="lp-quiz-liste">
          {questions.map((qcm, q) => {
            const choisi = reponses[q] ?? null;
            const repondu = choisi !== null;
            const correct = choisi === qcm.correct;
            return (
              <li key={q} className="lp-quiz-item">
                <p className="lp-quiz-question" id={`lp-q${q}`}>
                  {total > 1 && <span className="lp-quiz-num">{q + 1}.</span>} {qcm.question}
                </p>
                <div className="lp-quiz-options" role="group" aria-labelledby={`lp-q${q}`}>
                  {qcm.options.map((opt, i) => {
                    const juste = repondu && i === qcm.correct;
                    const faux = repondu && i === choisi && !correct;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={repondu}
                        onClick={() => choisir(q, i)}
                        className={`lp-quiz-option${juste ? ' lp-quiz-option--juste' : faux ? ' lp-quiz-option--faux' : ''}`}
                      >
                        <b aria-hidden="true">{String.fromCharCode(65 + i)}</b>
                        <span>{opt}</span>
                        {juste && <span style={{ marginLeft: 'auto' }} aria-label="bonne réponse">✓</span>}
                        {faux && <span style={{ marginLeft: 'auto' }} aria-label="réponse choisie, inexacte">✗</span>}
                      </button>
                    );
                  })}
                </div>
                {repondu && (
                  <p className="lp-quiz-explication" aria-live="polite">
                    <b>{correct ? 'Bonne réponse. ' : 'Ce n’est pas la bonne réponse, elle est signalée en vert. '}</b>
                    {qcm.explication}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {fini && (
          <div className={`lp-quiz-score${justes >= requis ? ' lp-quiz-score--reussi' : ''}`} role="status">
            <p>
              <b>
                {justes} / {total}
              </b>{' '}
              {justes >= requis
                ? '— quiz réussi.'
                : `— il faut ${requis} bonnes réponses pour valider. Relisez les sections concernées, puis recommencez.`}
            </p>
            <button type="button" className="lp-quiz-recommencer" onClick={() => setReponses(questions.map(() => null))}>
              Recommencer
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
