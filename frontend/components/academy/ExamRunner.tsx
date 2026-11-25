'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Check, ChevronLeft, ChevronRight, Clock, Flag, RotateCcw, X } from 'lucide-react';

interface Q {
  id: string;
  question: string;
  options: string[];
}
interface Corrige {
  id: string;
  correct: number;
  bonne_reponse?: string;
  juste?: boolean;
  explication: string;
}

const NIVEAU_LABEL: Record<string, string> = {
  debutant: 'Initiation',
  intermediaire: 'Fondamental',
  avance: 'Technique',
  expert: 'Expert',
};

const COURS_PAR_NIVEAU: Record<string, string> = {
  debutant: 'academy-niveau-1-initiation',
  intermediaire: 'academy-niveau-2-fondamental',
  avance: 'academy-niveau-3-technique',
  expert: 'academy-niveau-4-expert',
};

function fmtChrono(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExamRunner({ niveau }: { niveau: string }) {
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [choix, setChoix] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ score: number; passed: boolean; corrige: Corrige[] } | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'run') return;
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/academy/exam/${niveau}/start`, { method: 'POST' });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error ?? 'Erreur');
      return;
    }
    setSessionId(d.session_id);
    setQuestions(d.questions);
    setChoix({});
    setFlagged({});
    setElapsed(0);
    setOnlyWrong(false);
    setIdx(0);
    setPhase('run');
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const answers = questions.map((q) => ({ id: q.id, options: q.options, choix: choix[q.id] ?? -1 }));
    const r = await fetch(`/api/academy/exam/${niveau}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, answers }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error ?? 'Erreur');
      return;
    }
    setResult(d);
    setPhase('result');
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
        <Link href="/formations/academy" className="text-sm text-muted transition-colors hover:text-ivory">
          ← Academy
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-ink">
            <Award size={14} aria-hidden />
            Certification · {NIVEAU_LABEL[niveau] ?? niveau}
          </p>
          <h1 className="mt-2 font-display text-2xl text-ivory sm:text-3xl">
            Examen de validation · {NIVEAU_LABEL[niveau] ?? niveau}
          </h1>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>• 20 questions tirées aléatoirement dans la banque du niveau (ordre des options mélangé).</li>
            <li>• Seuil de réussite : <strong className="text-ivory">70 %</strong> (14 bonnes réponses sur 20).</li>
            <li>• Navigation libre entre questions, marquage « à revoir » et corrigé détaillé à la fin.</li>
            <li>• Tentatives illimitées.</li>
          </ul>
          {error && <p className="mt-4 rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-down">{error}</p>}
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2 disabled:opacity-50"
          >
            {busy ? 'Préparation…' : 'Commencer l’examen →'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'run') {
    const q = questions[idx]!;
    const answeredCount = Object.keys(choix).length;
    const isFlagged = Boolean(flagged[q.id]);

    return (
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {/* Barre supérieure : avancement + chrono */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span className="tabular font-medium text-ivory">
            Question {idx + 1} / {questions.length}
          </span>
          <div className="flex items-center gap-4">
            <span className="tabular">{answeredCount} / {questions.length} répondues</span>
            <span className="tabular inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-ivory">
              <Clock size={12} aria-hidden className="text-accent-ink" />
              {fmtChrono(elapsed)}
            </span>
          </div>
        </div>

        {/* Grille cliquable des questions */}
        <div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Navigation des questions">
          {questions.map((item, k) => {
            const isCur = k === idx;
            const isAns = choix[item.id] != null;
            const isFl = Boolean(flagged[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIdx(k)}
                className={`tabular flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                  isCur
                    ? 'border-accent bg-accent text-bg'
                    : isFl
                      ? 'border-warn/60 bg-warn/15 text-warn'
                      : isAns
                        ? 'border-accent/40 bg-accent/10 text-accent-ink'
                        : 'border-border bg-surface text-muted hover:text-ivory'
                }`}
                aria-label={`Question ${k + 1}${isAns ? ', répondue' : ''}${isFl ? ', marquée à revoir' : ''}`}
              >
                {k + 1}
              </button>
            );
          })}
        </div>

        {/* Question */}
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold leading-snug text-ivory">{q.question}</h2>
            <button
              type="button"
              onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                isFlagged
                  ? 'border-warn/50 bg-warn/15 text-warn'
                  : 'border-border text-muted hover:text-ivory'
              }`}
            >
              <Flag size={12} aria-hidden />
              <span>{isFlagged ? 'Marquée' : 'À revoir'}</span>
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {q.options.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChoix((c) => ({ ...c, [q.id]: i }))}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                  choix[q.id] === i
                    ? 'border-accent bg-accent/15 text-ivory font-medium'
                    : 'border-border bg-bg/50 text-muted hover:border-border-strong hover:text-ivory'
                }`}
              >
                <span className="mt-0.5 font-semibold text-accent-ink">{String.fromCharCode(65 + i)}.</span>
                <span>{o}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-down">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-ivory disabled:opacity-30"
          >
            <ChevronLeft size={15} aria-hidden />
            Précédent
          </button>
          {idx + 1 < questions.length ? (
            <button
              type="button"
              onClick={() => setIdx((i) => i + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-gold-2"
            >
              Suivant
              <ChevronRight size={15} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={answeredCount < questions.length || busy}
              className="rounded-lg bg-up px-5 py-2 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Correction…' : 'Terminer et corriger'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // phase === 'result'
  const byId = new Map((result?.corrige ?? []).map((c) => [c.id, c]));
  const totalBonnes = result?.corrige.filter((c) => c.juste).length ?? Math.round(((result?.score ?? 0) / 100) * questions.length);
  const shownQuestions = onlyWrong
    ? questions.filter((q) => byId.get(q.id)?.juste === false)
    : questions;
  const slugCours = COURS_PAR_NIVEAU[niveau];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div
        className={`rounded-2xl border p-6 ${
          result!.passed ? 'border-up/40 bg-up/10' : 'border-down/40 bg-down/10'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl text-ivory sm:text-3xl">
              {result!.passed ? '✓ Examen réussi' : '✗ Seuil non atteint'}
            </p>
            <p className="tabular mt-1 text-sm text-muted">
              Score : <strong className="text-ivory">{result!.score} %</strong> ({totalBonnes} / {questions.length}) · Seuil
              requis : 70 % · Durée : {fmtChrono(elapsed)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {result!.passed ? (
              <Link
                href={`/formations/academy/certificat?niveau=${niveau}`}
                className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-95"
              >
                Générer mon certificat →
              </Link>
            ) : (
              <>
                {slugCours && (
                  <Link
                    href={`/formations/academy/${slugCours}`}
                    className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ivory hover:border-accent/50"
                  >
                    Revoir le cours
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPhase('intro');
                    setResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg hover:bg-gold-2"
                >
                  <RotateCcw size={14} aria-hidden />
                  Repasser l’examen
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Corrigé détaillé question par question */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ivory">Corrigé détaillé</h2>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setOnlyWrong(false)}
              className={`rounded-md px-3 py-1 font-medium ${
                !onlyWrong ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ivory'
              }`}
            >
              Toutes ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyWrong(true)}
              className={`rounded-md px-3 py-1 font-medium ${
                onlyWrong ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ivory'
              }`}
            >
              Erreurs ({questions.length - totalBonnes})
            </button>
          </div>
        </div>

        <ol className="space-y-3">
          {shownQuestions.map((q) => {
            const c = byId.get(q.id);
            const pickedIdx = choix[q.id];
            const pickedText = pickedIdx != null && pickedIdx >= 0 ? q.options[pickedIdx] : 'Non répondue';
            const juste = c?.juste ?? false;
            const num = questions.findIndex((x) => x.id === q.id) + 1;
            return (
              <li
                key={q.id}
                className={`rounded-xl border p-4 ${
                  juste ? 'border-up/30 bg-surface' : 'border-down/35 bg-surface'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      juste ? 'bg-up/20 text-up' : 'bg-down/20 text-down'
                    }`}
                  >
                    {juste ? <Check size={12} strokeWidth={2.5} aria-label="Juste" /> : <X size={12} strokeWidth={2.5} aria-label="Faux" />}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <p className="font-semibold text-ivory">
                      <span className="tabular mr-1.5 text-faint">Q{num}.</span>
                      {q.question}
                    </p>
                    <p className="text-xs text-muted">
                      Votre réponse :{' '}
                      <span className={juste ? 'font-medium text-up' : 'font-medium text-down'}>{pickedText}</span>
                    </p>
                    {!juste && c?.bonne_reponse && (
                      <p className="text-xs text-muted">
                        Bonne réponse : <span className="font-semibold text-up">{c.bonne_reponse}</span>
                      </p>
                    )}
                    {c?.explication && (
                      <p className="rounded-lg bg-bg/60 px-3 py-2 text-xs leading-relaxed text-muted">
                        {c.explication}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
