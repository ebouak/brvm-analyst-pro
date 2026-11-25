'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Compass, RotateCcw, X } from 'lucide-react';
import { QUESTIONS_PLACEMENT, evaluerPlacement } from '@/lib/academy/placement';
import type { ObjectifId } from '@/lib/academy/capsules';

export default function QuizPlacement({
  onApplyGoal,
  onClose,
}: {
  onApplyGoal?: (goal: ObjectifId) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [reponses, setReponses] = useState<(number | null)[]>(() => QUESTIONS_PLACEMENT.map(() => null));
  const [done, setDone] = useState(false);

  const q = QUESTIONS_PLACEMENT[step]!;
  const chosen = reponses[step];
  const progressPct = Math.round(((done ? QUESTIONS_PLACEMENT.length : step) / QUESTIONS_PLACEMENT.length) * 100);

  const pick = (i: number) => {
    const next = reponses.map((v, k) => (k === step ? i : v));
    setReponses(next);
    if (step + 1 < QUESTIONS_PLACEMENT.length) {
      setStep(step + 1);
    } else {
      setDone(true);
    }
  };

  const reset = () => {
    setReponses(QUESTIONS_PLACEMENT.map(() => null));
    setStep(0);
    setDone(false);
  };

  const res = done ? evaluerPlacement(reponses.map((v) => v ?? -1)) : null;

  return (
    <section
      aria-label="Test de placement Academy"
      className="rounded-2xl border border-accent/40 bg-surface p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-ink">
          <Compass size={15} aria-hidden />
          <span>Diagnostic rapide · 5 questions (2 min)</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le quiz de placement"
          className="text-faint hover:text-ivory"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {!done ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-faint">
            <span>
              Question {step + 1} / {QUESTIONS_PLACEMENT.length} · {q.theme}
            </span>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="text-muted hover:text-ivory"
              >
                ← Précédente
              </button>
            )}
          </div>
          <h3 className="font-display text-lg font-medium leading-snug text-ivory">{q.question}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(i)}
                className={`rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                  chosen === i
                    ? 'border-accent bg-accent/15 text-ivory'
                    : 'border-border bg-bg/60 text-muted hover:border-border-strong hover:text-ivory'
                }`}
              >
                <span className="mr-2 font-semibold text-accent-ink">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        res && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-sunken/70 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="tabular text-xs font-semibold text-up">
                  Score : {res.score} / {res.total}
                </p>
                <h3 className="mt-1 font-display text-xl text-ivory">{res.titre}</h3>
                <p className="mt-1 max-w-2xl text-sm text-muted">{res.raison}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {onApplyGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyGoal(res.objectifSuggere);
                      onClose();
                    }}
                    className="rounded-lg border border-border-strong bg-surface px-3.5 py-2 text-xs font-semibold text-ivory hover:border-accent/50"
                  >
                    Mettre en avant ce parcours
                  </button>
                )}
                <Link
                  href={`/formations/academy/${res.slugRecommande}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-gold-2"
                >
                  <span>Ouvrir le parcours</span>
                  <ChevronRight size={14} aria-hidden />
                </Link>
              </div>
            </div>

            <details className="rounded-xl border border-border bg-bg/50 p-3.5">
              <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ivory">
                Voir le corrigé des 5 questions
              </summary>
              <ul className="mt-3 space-y-2.5">
                {QUESTIONS_PLACEMENT.map((item, idx) => {
                  const d = res.details[idx]!;
                  return (
                    <li key={item.id} className="border-b border-border/50 pb-2 text-xs last:border-0 last:pb-0">
                      <p className="flex items-center gap-1.5 font-medium text-ivory">
                        {d.juste ? (
                          <Check size={13} className="shrink-0 text-up" aria-label="Juste" />
                        ) : (
                          <X size={13} className="shrink-0 text-down" aria-label="À revoir" />
                        )}
                        <span>{item.theme}</span>
                      </p>
                      <p className="mt-0.5 leading-relaxed text-muted">{d.explication}</p>
                    </li>
                  );
                })}
              </ul>
            </details>

            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ivory"
            >
              <RotateCcw size={13} aria-hidden />
              Refaire le diagnostic
            </button>
          </div>
        )
      )}
    </section>
  );
}
