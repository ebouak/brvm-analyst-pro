'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Q { id: string; question: string; options: string[] }
interface Corrige { id: string; correct: number; explication: string }
const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation', intermediaire: 'Fondamental', avance: 'Technique', expert: 'Expert' };

export default function ExamRunner({ niveau }: { niveau: string }) {
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [choix, setChoix] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; corrige: Corrige[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/academy/exam/${niveau}/start`, { method: 'POST' });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
    setQuestions(d.questions); setChoix({}); setIdx(0); setPhase('run');
  }

  async function submit() {
    setBusy(true);
    const answers = questions.map((q) => ({ id: q.id, options: q.options, choix: choix[q.id] ?? -1 }));
    const r = await fetch(`/api/academy/exam/${niveau}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
    });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
    setResult(d); setPhase('result');
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Link href="/formations/academy" className="text-sm text-muted hover:text-white">← Academy</Link>
        <h1 className="font-display text-2xl text-white">Examen · {NIVEAU_LABEL[niveau] ?? niveau}</h1>
        <p className="text-sm text-muted">20 questions tirées au hasard. Réussite à partir de 70 %. Tentatives illimitées.</p>
        {error && <p className="rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-down">{error}</p>}
        <button type="button" onClick={start} disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">
          {busy ? '…' : 'Commencer l’examen'}
        </button>
      </div>
    );
  }

  if (phase === 'run') {
    const q = questions[idx]!;
    const answered = choix[q.id] != null;
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
        <div className="flex items-center justify-between text-xs text-faint">
          <span>Question {idx + 1} / {questions.length}</span>
          <span>{Object.keys(choix).length} répondues</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full bg-accent" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
        <h2 className="text-lg font-semibold text-ivory">{q.question}</h2>
        <div className="space-y-2">
          {q.options.map((o, i) => (
            <button key={i} type="button" onClick={() => setChoix((c) => ({ ...c, [q.id]: i }))}
              className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                choix[q.id] === i ? 'border-accent bg-accent/10 text-white' : 'border-border bg-surface text-muted hover:border-accent/40'}`}>
              {o}
            </button>
          ))}
        </div>
        <div className="flex justify-between pt-2">
          <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted disabled:opacity-30">← Précédent</button>
          {idx + 1 < questions.length ? (
            <button type="button" onClick={() => setIdx((i) => i + 1)} disabled={!answered}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">Suivant →</button>
          ) : (
            <button type="button" onClick={submit} disabled={Object.keys(choix).length < questions.length || busy}
              className="rounded-lg bg-up px-5 py-2 text-sm font-semibold text-bg disabled:opacity-40">Terminer</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <div className={`rounded-xl border p-5 ${result!.passed ? 'border-up/40 bg-up/10' : 'border-down/40 bg-down/10'}`}>
        <p className="font-display text-2xl text-white">{result!.passed ? '✓ Réussi' : '✗ Non validé'}</p>
        <p className="tabular mt-1 text-sm text-muted">Score : {result!.score} % (seuil 70 %)</p>
      </div>
      {result!.passed && (
        <Link href={`/formations/academy/certificat?niveau=${niveau}`}
          className="inline-block rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-bg">Générer mon certificat →</Link>
      )}
      {!result!.passed && (
        <button type="button" onClick={() => { setPhase('intro'); setResult(null); }}
          className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted hover:text-white">Repasser l’examen</button>
      )}
      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm text-muted">Voir le corrigé</summary>
        <ul className="mt-3 space-y-2">
          {result!.corrige.map((c) => (
            <li key={c.id} className="border-b border-border/40 pb-2 text-xs text-faint last:border-0">{c.explication}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
