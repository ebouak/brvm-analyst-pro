'use client';

import { useState } from 'react';
import type { Qcm } from '@/lib/academy/types';

/** QCM d'une leçon (une question). Le parent enregistre le résultat via onAnswer. */
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
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ivory">Quiz — {qcm.question}</p>
        {alreadyPassed && !answered && (
          <span className="shrink-0 rounded-full bg-up/15 px-2 py-0.5 text-[11px] font-medium text-up">
            Déjà réussi ✓
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {qcm.options.map((opt, i) => {
          const isCorrect = answered && i === qcm.correct;
          const isWrongPick = answered && i === picked && !correct;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => choose(i)}
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
          {qcm.explication}
        </p>
      )}
    </div>
  );
}
