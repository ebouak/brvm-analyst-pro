'use client';

import { useState } from 'react';
import type { PublicExercise } from '@/lib/academy/exercises';
import { checkExercise, type ExerciseCheck } from '@/app/formations/academy/actions';

/**
 * Exercice sur données LIVE : l'énoncé porte la date des données, la correction
 * est recalculée côté serveur avec les mêmes données (jamais de corrigé figé).
 */
export default function ExerciseBlock({
  exercise,
  courseId,
  lessonIdx,
  alreadyPassed,
  onResult,
}: {
  exercise: PublicExercise;
  courseId: string;
  lessonIdx: number;
  alreadyPassed: boolean | null;
  onResult: (correct: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<ExerciseCheck | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const answer = exercise.type === 'choice'
      ? picked
      : Number.parseFloat(value.replace(',', '.'));
    if (answer == null || (typeof answer === 'number' && !Number.isFinite(answer))) return;
    setPending(true);
    const r = await checkExercise(courseId, lessonIdx, exercise.id, Number(answer));
    setPending(false);
    setResult(r);
    if (r.ok && r.correct != null) onResult(r.correct);
  };

  const answered = result?.ok === true;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="overline text-accent">Exercice — données réelles</p>
        {alreadyPassed && !answered && (
          <span className="rounded-full bg-up/15 px-2 py-0.5 text-[11px] font-medium text-up">Déjà réussi ✓</span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ivory">{exercise.titre}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{exercise.enonce}</p>

      {exercise.type === 'numeric' ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            disabled={answered}
            placeholder="Votre réponse"
            className="w-40 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
          />
          {exercise.unite && <span className="text-sm text-muted">{exercise.unite}</span>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {(exercise.options ?? []).map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${
                picked === i
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-border bg-bg text-muted hover:border-accent/40 hover:text-white'
              }`}
            >
              <span aria-hidden className="text-xs text-faint">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
      )}

      {!answered && (
        <button
          type="button"
          onClick={submit}
          disabled={pending || (exercise.type === 'choice' ? picked == null : !value.trim())}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:bg-gold-2 active:scale-95 disabled:opacity-50"
        >
          {pending ? 'Correction…' : 'Vérifier'}
        </button>
      )}

      {answered && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${
            result!.correct ? 'border-up/40 bg-up/10 text-up' : 'border-down/40 bg-down/10 text-down'
          }`}
        >
          <p className="font-semibold">
            {result!.correct ? 'Correct !' : `Pas tout à fait — réponse attendue : ${result!.attendu}`}
          </p>
          {result!.explication && (
            <p className="mt-1 text-xs leading-relaxed opacity-90">{result!.explication}</p>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] text-faint">
        Données de la séance du {exercise.asOf} — la correction est recalculée sur ces mêmes données.
      </p>
    </div>
  );
}
