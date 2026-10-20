'use client';

import { useState } from 'react';
import type { Qcm } from '@/lib/academy/types';

/**
 * QCM d'une leçon (une question), sur la surface de lecture claire `.lp`
 * (components/academy/lecon/lecon.css). Le parent enregistre le résultat via
 * onAnswer ; l'explication s'affiche après la réponse.
 */
export default function QcmBlock({
  qcm,
  alreadyPassed,
  onAnswer,
}: {
  qcm: Qcm;
  alreadyPassed: boolean | null;
  onAnswer: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === qcm.correct;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    onAnswer(i === qcm.correct);
  };

  return (
    <section className="lp-quiz" aria-labelledby="lp-quiz-question">
      <div className="lp-col">
        <p className="lp-kicker">
          Quiz {alreadyPassed && !answered && <span className="lp-quiz-deja">· déjà réussi ✓</span>}
        </p>
        <p id="lp-quiz-question" className="lp-quiz-question">{qcm.question}</p>
        <div className="lp-quiz-options">
          {qcm.options.map((opt, i) => {
            const isCorrect = answered && i === qcm.correct;
            const isWrongPick = answered && i === picked && !correct;
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => choose(i)}
                className={`lp-quiz-option${isCorrect ? ' lp-quiz-option--juste' : isWrongPick ? ' lp-quiz-option--faux' : ''}`}
              >
                <b aria-hidden="true">{String.fromCharCode(65 + i)}</b>
                <span>{opt}</span>
                {isCorrect && <span style={{ marginLeft: 'auto' }} aria-label="bonne réponse">✓</span>}
                {isWrongPick && <span style={{ marginLeft: 'auto' }} aria-label="réponse choisie, inexacte">✗</span>}
              </button>
            );
          })}
        </div>
        {answered && (
          <p className="lp-quiz-explication" aria-live="polite">
            <b>{correct ? 'Bonne réponse. ' : 'Ce n’est pas la bonne réponse, elle est signalée en vert. '}</b>
            {qcm.explication}
          </p>
        )}
      </div>
    </section>
  );
}
