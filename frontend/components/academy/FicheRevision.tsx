'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Layers, Printer, RotateCw, X } from 'lucide-react';
import type { CourseContent } from '@/lib/academy/types';
import { extraireCartesRevision, type FlashcardMemo } from '@/lib/academy/capsules';

type Mode = 'flashcards' | 'memo';
type CatFilter = 'Toutes' | FlashcardMemo['categorie'];

/**
 * Espace « Révision & Fiche mémo » du cours :
 *  - Flashcards recto/verso générées depuis les formules, pièges, points à
 *    retenir et le glossaire du cours (avec clavier Espace / ← / →).
 *  - Fiche mémo imprimable / PDF regroupant toutes les formules et alertes.
 */
export default function FicheRevision({
  content,
  onClose,
}: {
  content: CourseContent;
  onClose: () => void;
}) {
  const rev = useMemo(() => extraireCartesRevision(content), [content]);
  const [mode, setMode] = useState<Mode>(rev.flashcards.length > 0 ? 'flashcards' : 'memo');
  const [cat, setCat] = useState<CatFilter>('Toutes');
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Record<string, boolean>>({});

  const categories: CatFilter[] = useMemo(() => {
    const present = new Set(rev.flashcards.map((c) => c.categorie));
    const ord: FlashcardMemo['categorie'][] = ['Formule', 'À retenir', 'Piège', 'Lexique'];
    return ['Toutes', ...ord.filter((k) => present.has(k))];
  }, [rev.flashcards]);

  const cards = useMemo(
    () => (cat === 'Toutes' ? rev.flashcards : rev.flashcards.filter((c) => c.categorie === cat)),
    [rev.flashcards, cat],
  );

  const safeIdx = Math.min(idx, Math.max(0, cards.length - 1));
  const card = cards[safeIdx];
  const masteredCount = rev.flashcards.filter((c) => mastered[c.id]).length;

  const go = useCallback(
    (delta: number) => {
      if (cards.length === 0) return;
      setIdx((i) => (i + delta + cards.length) % cards.length);
      setFlipped(false);
    },
    [cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (mode !== 'flashcards') return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        go(1);
      } else if (e.key === 'ArrowLeft') {
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, go, onClose]);

  return (
    <div
      className="rev-root fixed inset-0 z-[60] flex flex-col bg-bg/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Révision et fiche mémo du cours"
    >
      {/* Barre supérieure */}
      <header className="rev-toolbar border-b border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-ivory"
            >
              <X size={14} aria-hidden />
              Fermer
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ivory">{content.titre}</p>
              <p className="tabular text-[11px] text-faint">
                {rev.flashcards.length} cartes · {rev.formules.length} formules · {rev.pieges.length} pièges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-bg p-0.5">
              <button
                type="button"
                onClick={() => setMode('flashcards')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === 'flashcards' ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ivory'
                }`}
              >
                <Layers size={13} aria-hidden />
                Flashcards
              </button>
              <button
                type="button"
                onClick={() => setMode('memo')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === 'memo' ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ivory'
                }`}
              >
                <BookOpen size={13} aria-hidden />
                Fiche mémo PDF
              </button>
            </div>
            {mode === 'memo' && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-accent-ink hover:border-accent/50"
              >
                <Printer size={13} aria-hidden />
                Imprimer / PDF
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {mode === 'flashcards' ? (
          <div className="mx-auto max-w-2xl space-y-5">
            {/* Filtres de catégories */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCat(c);
                      setIdx(0);
                      setFlipped(false);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      cat === c
                        ? 'bg-ivory text-bg font-semibold'
                        : 'border border-border bg-surface text-muted hover:text-ivory'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <span className="tabular text-xs text-muted">
                Maîtrisées : <strong className="text-up">{masteredCount}</strong> / {rev.flashcards.length}
              </span>
            </div>

            {card ? (
              <>
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  className="flex min-h-[270px] w-full flex-col justify-between rounded-2xl border border-border-strong bg-surface p-6 text-left shadow-card transition hover:border-accent/50 sm:p-8"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
                      {card.categorie} · {flipped ? 'Réponse' : 'Question / Notion'}
                    </span>
                    <span className="tabular text-xs text-faint">
                      {safeIdx + 1} / {cards.length}
                    </span>
                  </div>

                  <div className="my-6">
                    {!flipped ? (
                      <p className="font-display text-2xl font-medium leading-snug text-ivory sm:text-3xl">
                        {card.recto}
                      </p>
                    ) : (
                      <p className="whitespace-pre-line text-base leading-relaxed text-ivory/95">{card.verso}</p>
                    )}
                  </div>

                  <div className="flex w-full items-center justify-between text-xs text-faint">
                    <span className="truncate">{card.source}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-accent-ink">
                      <RotateCw size={12} aria-hidden />
                      Cliquer ou Espace pour retourner
                    </span>
                  </div>
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted hover:text-ivory"
                    >
                      <ChevronLeft size={14} aria-hidden />
                      Précédente
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted hover:text-ivory"
                    >
                      Suivante
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMastered((m) => ({ ...m, [card.id]: !m[card.id] }));
                      if (!mastered[card.id]) go(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                      mastered[card.id]
                        ? 'bg-up/20 text-up border border-up/40'
                        : 'bg-accent text-bg hover:bg-gold-2'
                    }`}
                  >
                    <Check size={14} aria-hidden />
                    {mastered[card.id] ? 'Maîtrisée ✓' : 'Marquer maîtrisée'}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
                Aucune carte disponible dans cette catégorie.
              </div>
            )}
          </div>
        ) : (
          <div className="rev-memo mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <div className="border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">WESTBOURSE Academy · Fiche mémo</p>
              <h2 className="mt-1 font-display text-2xl text-ivory">{content.titre}</h2>
              <p className="mt-1 text-sm text-muted">{content.intro}</p>
            </div>

            {rev.formules.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-display text-lg text-ivory">Formules clés du cours</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rev.formules.map((f, i) => (
                    <div key={i} className="rounded-xl border border-border bg-bg/50 p-3.5">
                      <p className="text-xs font-semibold text-accent-ink">{f.nom}</p>
                      <p className="mt-1 font-display text-base text-ivory">{f.expression}</p>
                      {f.exemple && <p className="tabular mt-1 text-xs text-muted">{f.exemple}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {rev.pieges.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-display text-lg text-ivory">Pièges fréquents à éviter</h3>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {rev.pieges.map((p, i) => (
                    <li key={i} className="rounded-xl border border-border bg-bg/50 p-3.5">
                      <p className="text-xs font-semibold text-warn">{p.titre}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{p.detail}</p>
                      {p.verifier && <p className="mt-1 text-[11px] text-ivory/80">À vérifier : {p.verifier}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(content.glossaire?.length ?? 0) > 0 && (
              <section className="space-y-3">
                <h3 className="font-display text-lg text-ivory">Glossaire express</h3>
                <dl className="grid gap-2.5 sm:grid-cols-2">
                  {content.glossaire!.map((g) => (
                    <div key={g.terme} className="rounded-lg border border-border/60 p-3">
                      <dt className="text-xs font-semibold text-accent-ink">{g.terme}</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-muted">{g.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .rev-toolbar { display: none !important; }
          .rev-root { position: static !important; background: #fff !important; color: #111 !important; }
          .rev-memo { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
