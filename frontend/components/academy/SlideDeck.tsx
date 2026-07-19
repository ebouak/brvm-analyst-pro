'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CourseContent } from '@/lib/academy/types';
import { courseToSlides, splitNumbered, type Slide } from '@/lib/academy/slides';
import { SECTION_LABEL } from '@/lib/academy/types';
import LessonChart from './LessonChart';

/**
 * Mode présentation — rend le cours en diapositives fidèles au support PDF
 * « BRVM Academy » : fond bleu marine / crème, titres or, cartes et frises.
 * Navigation clavier (← →, Échap), plein écran, et impression → PDF (chaque
 * diapo = une page paysage). Les données proviennent du cours existant.
 */

/** Dimensions « natives » d'une diapo (16/9) — l'écran la met à l'échelle pour l'ajuster. */
const DESIGN_W = 1120;
const DESIGN_H = 630;

const NAVY = '#123a5e';
const NAVY_DEEP = '#0c2740';
const GOLD = '#d4a53c';
const GREEN = '#2e9e5f';
const RED = '#c0392b';
const CREAM = '#f5f0e6';
const INK = '#16324e';
const MUTED = '#5f7080';

/** Couleur d'accent d'une section selon son type (barre supérieure + repère). */
const SECTION_ACCENT: Record<string, string> = {
  definition: NAVY,
  importance: GOLD,
  cas: GREEN,
  piege: RED,
  lexique: NAVY,
  retenir: GREEN,
};

export default function SlideDeck({ content, onClose }: { content: CourseContent; onClose: () => void }) {
  const slides = useMemo(() => courseToSlides(content), [content]);
  const [idx, setIdx] = useState(0);
  const total = slides.length;
  const clamp = useCallback((i: number) => Math.min(Math.max(0, i), total - 1), [total]);

  const go = useCallback((i: number) => setIdx((prev) => clamp(typeof i === 'number' ? i : prev)), [clamp]);

  // Met la diapo (1120×630) à l'échelle pour tenir entièrement dans la scène —
  // évite tout rognage vertical quel que soit le format de l'écran.
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const compute = () => {
      const s = Math.min(el.clientWidth / DESIGN_W, el.clientHeight / DESIGN_H);
      setScale(s > 0 ? s : 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); setIdx((i) => clamp(i + 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setIdx((i) => clamp(i - 1)); }
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End') setIdx(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clamp, onClose, total]);

  return (
    <div className="deck-root fixed inset-0 z-[60] flex flex-col" style={{ background: NAVY_DEEP }}>
      {/* Barre d'outils (masquée à l'impression) */}
      <div className="deck-toolbar flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
        <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1 text-sm text-white/80 hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
          ✕ Fermer
        </button>
        <span className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>BRVM Academy · Présentation</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-md px-2.5 py-1 text-sm text-white/80 hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            ⤓ Imprimer / PDF
          </button>
          <span className="tabular text-sm text-white/70">{idx + 1} / {total}</span>
        </div>
      </div>

      {/* Zone diapo — à l'écran : la diapo active, mise à l'échelle pour s'ajuster. */}
      <div ref={stageRef} className="deck-stage flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
        <div className="deck-screen" style={{ width: DESIGN_W * scale, height: DESIGN_H * scale }}>
          <div
            className="deck-canvas"
            style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            <SlideView slide={slides[idx]!} page={idx + 1} total={total} />
          </div>
        </div>
      </div>

      {/* À l'impression uniquement : toutes les diapos, une par page paysage. */}
      <div className="deck-print">
        {slides.map((s, i) => (
          <div key={i} className="deck-print-slide">
            <SlideView slide={s} page={i + 1} total={total} />
          </div>
        ))}
      </div>

      {/* Navigation (masquée à l'impression) */}
      <div className="deck-nav flex items-center justify-center gap-4 px-4 py-3" style={{ borderTop: `1px solid rgba(255,255,255,0.1)` }}>
        <button type="button" onClick={() => setIdx((i) => clamp(i - 1))} disabled={idx === 0}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.08)' }}>
          ← Précédent
        </button>
        <div className="hidden gap-1 sm:flex">
          {slides.map((_, i) => (
            <button key={i} type="button" onClick={() => go(i)} aria-label={`Diapo ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === idx ? 20 : 8, background: i === idx ? GOLD : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
        <button type="button" onClick={() => setIdx((i) => clamp(i + 1))} disabled={idx === total - 1}
          className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: GOLD, color: NAVY_DEEP }}>
          Suivant →
        </button>
      </div>

      <style jsx global>{`
        .deck-canvas {
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .deck-print { display: none; }
        @media print {
          @page { size: landscape; margin: 0; }
          .deck-toolbar, .deck-nav, .deck-stage { display: none !important; }
          .deck-root { position: static !important; background: #fff !important; }
          .deck-print { display: block !important; }
          .deck-print-slide {
            width: 100%;
            aspect-ratio: 16 / 9;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
}

// ── Une diapositive ──────────────────────────────────────────────────────────

function Foot({ page, total, label }: { page: number; total: number; label: string }) {
  return (
    <div className="flex items-center justify-between px-8 pb-4 text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
      <span>{label}</span>
      <span className="tabular">{String(page).padStart(2, '0')} / {total}</span>
    </div>
  );
}

function SlideView({ slide, page, total }: { slide: Slide; page: number; total: number }) {
  if (slide.kind === 'cover') {
    return (
      <div className="flex h-full flex-col" style={{ background: NAVY, color: '#fff' }}>
        <div className="flex flex-1 flex-col justify-center px-10 sm:px-14">
          <span className="mb-4 inline-block w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
            UEMOA · 8 pays · un marché
          </span>
          <h1 className="font-display text-4xl leading-tight sm:text-6xl" style={{ color: GOLD }}>{slide.titre}</h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg" style={{ color: 'rgba(255,255,255,0.85)' }}>{slide.sousTitre}</p>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-4">
            {slide.stats.map((s, i) => (
              <div key={i}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</p>
                <p className="tabular mt-1 text-xl font-bold sm:text-2xl" style={{ color: '#fff' }}>{s.valeur}</p>
              </div>
            ))}
          </div>
        </div>
        <Foot page={page} total={total} label="Module pédagogique · session 2026 · source : BRVM" />
      </div>
    );
  }

  if (slide.kind === 'sommaire') {
    return (
      <div className="flex h-full flex-col" style={{ background: CREAM, color: INK }}>
        <div className="flex-1 px-10 pt-8 sm:px-14">
          <h2 className="font-display text-3xl sm:text-4xl" style={{ color: NAVY }}>
            {slide.titre} <span style={{ color: GOLD }}>en {slide.items.length} leçons</span>
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
            {slide.items.slice(0, 8).map((it) => (
              <div key={it.num} className="rounded-lg border p-3" style={{ borderColor: '#e2d8c4', background: '#fff' }}>
                <span className="font-display text-2xl" style={{ color: GOLD }}>{String(it.num).padStart(2, '0')}</span>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: NAVY }}>{it.titre}</p>
                <p className="mt-0.5 text-xs" style={{ color: MUTED }}>{it.resume}</p>
              </div>
            ))}
          </div>
        </div>
        <Foot page={page} total={total} label="BRVM Academy · programme" />
      </div>
    );
  }

  if (slide.kind === 'lesson-intro') {
    return (
      <div className="flex h-full" style={{ background: NAVY, color: '#fff' }}>
        <div className="hidden w-2/5 items-center justify-center sm:flex" style={{ background: NAVY_DEEP }}>
          <span className="font-display leading-none" style={{ fontSize: '11rem', color: GOLD }}>{String(slide.num).padStart(2, '0')}</span>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center px-8 sm:px-12">
            <span className="mb-2 h-1 w-12" style={{ background: GOLD }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: GOLD }}>{slide.sur}</p>
            <h1 className="mt-2 font-display text-3xl leading-tight sm:text-5xl">{slide.titre}</h1>
            <p className="mt-3 max-w-xl text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>{slide.resume}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-8 pb-6 sm:px-12">
            {slide.objectifs.map((o, i) => (
              <div key={i}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: GOLD }}>Objectif {i + 1}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{o}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'chart') {
    return (
      <div className="flex h-full flex-col" style={{ background: CREAM, color: INK }}>
        <div className="flex flex-1 flex-col px-10 pt-8 sm:px-14">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Leçon {String(slide.leconNum).padStart(2, '0')} · graphique</p>
          <div className="mt-3 flex-1">
            <LessonChart chart={slide.chart} variant="slide" />
          </div>
        </div>
        <Foot page={page} total={total} label={slide.leconTitre} />
      </div>
    );
  }

  if (slide.kind === 'quiz') {
    return <QuizSlide slide={slide} page={page} total={total} />;
  }

  // slide.kind === 'section'
  return <SectionSlide slide={slide} page={page} total={total} />;
}

function SectionSlide({
  slide, page, total,
}: {
  slide: Extract<Slide, { kind: 'section' }>;
  page: number;
  total: number;
}) {
  const s = slide.section;
  const accent = SECTION_ACCENT[s.type] ?? NAVY;
  const isPiege = s.type === 'piege';
  const bg = isPiege ? '#2a0f0f' : CREAM;
  const textColor = isPiege ? '#fff' : INK;
  const retenirItems = s.type === 'retenir' ? splitNumbered(s.contenu) : [];

  return (
    <div className="flex h-full flex-col" style={{ background: bg, color: textColor }}>
      <div className="h-1.5 w-full" style={{ background: accent }} />
      <div className="flex-1 overflow-hidden px-10 pt-6 sm:px-14">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: isPiege ? RED : accent }}>
          Leçon {String(slide.leconNum).padStart(2, '0')} · {SECTION_LABEL[s.type] ?? ''}
        </p>
        <h2 className="mt-1 font-display text-2xl leading-tight sm:text-4xl" style={{ color: isPiege ? '#fff' : NAVY }}>{s.titre}</h2>

        {/* Corps : cartes numérotées (à retenir) ou texte */}
        {retenirItems.length >= 2 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {retenirItems.slice(0, 6).map((it, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: '#e2d8c4', background: '#fff' }}>
                <span className="font-display text-xl" style={{ color: GREEN }}>{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: INK }}>{it}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed sm:text-[15px]" style={{ color: isPiege ? 'rgba(255,255,255,0.85)' : '#33475b' }}>
            {s.contenu}
          </p>
        )}

        {/* Chiffres clés */}
        {s.stats && s.stats.length > 0 && (
          <div className={`mt-4 grid gap-3 grid-cols-${Math.min(s.stats.length, 4)}`} style={{ gridTemplateColumns: `repeat(${Math.min(s.stats.length, 4)}, minmax(0, 1fr))` }}>
            {s.stats.map((k, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: isPiege ? 'rgba(255,255,255,0.2)' : '#e2d8c4', background: isPiege ? 'rgba(255,255,255,0.05)' : '#fff' }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{k.label}</p>
                <p className="tabular mt-0.5 text-lg font-bold" style={{ color: isPiege ? GOLD : NAVY }}>{k.valeur}</p>
                {k.detail && <p className="mt-0.5 text-[10px] leading-snug" style={{ color: MUTED }}>{k.detail}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Tableau */}
        {s.tableau && (
          <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: '#e2d8c4' }}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ background: NAVY }}>
                  {s.tableau.colonnes.map((c, j) => (
                    <th key={j} className="px-3 py-2 font-semibold uppercase tracking-wide" style={{ color: '#fff' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.tableau.lignes.map((ligne, j) => (
                  <tr key={j} style={{ background: j % 2 ? '#faf7f0' : '#fff' }}>
                    {ligne.map((cell, k) => (
                      <td key={k} className="px-3 py-1.5" style={{ color: k === 0 ? NAVY : '#44586b', fontWeight: k === 0 ? 600 : 400 }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Frise d'étapes */}
        {s.etapes && s.etapes.length > 0 && (
          <div className={`mt-4 grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(s.etapes.length, 5)}, minmax(0, 1fr))` }}>
            {s.etapes.map((e, i) => (
              <div key={i} className="rounded-lg border p-2.5" style={{ borderColor: e.cle ? GOLD : '#e2d8c4', background: e.cle ? 'rgba(212,165,60,0.08)' : '#fff' }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: e.cle ? GOLD : NAVY, color: '#fff' }}>
                  {e.cle ? '★' : i + 1}
                </span>
                <p className="mt-1.5 text-[11px] font-semibold leading-tight" style={{ color: NAVY }}>{e.titre}</p>
                {e.detail && <p className="mt-0.5 text-[10px] leading-snug" style={{ color: MUTED }}>{e.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <Foot page={page} total={total} label={slide.leconTitre} />
    </div>
  );
}

function QuizSlide({
  slide, page, total,
}: {
  slide: Extract<Slide, { kind: 'quiz' }>;
  page: number;
  total: number;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const q = slide.qcm;

  return (
    <div className="flex h-full flex-col" style={{ background: NAVY, color: '#fff' }}>
      <div className="flex-1 px-10 pt-8 sm:px-14">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: GOLD }}>Quiz · Leçon {String(slide.num).padStart(2, '0')}</p>
        <h2 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">{q.question}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {q.options.map((opt, i) => {
            const revealed = choice !== null;
            const isCorrect = i === q.correct;
            const isPicked = i === choice;
            const border = revealed
              ? isCorrect ? GREEN : isPicked ? RED : 'rgba(255,255,255,0.15)'
              : 'rgba(255,255,255,0.2)';
            const bg = revealed && isCorrect ? 'rgba(46,158,95,0.18)' : revealed && isPicked ? 'rgba(192,57,43,0.15)' : 'rgba(255,255,255,0.04)';
            return (
              <button key={i} type="button" onClick={() => setChoice(i)} disabled={revealed}
                className="flex items-start gap-3 rounded-lg p-3 text-left transition-colors"
                style={{ border: `1px solid ${border}`, background: bg }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ border: `1px solid ${revealed && isCorrect ? GREEN : 'rgba(255,255,255,0.4)'}`, color: revealed && isCorrect ? GREEN : '#fff' }}>
                  {revealed && isCorrect ? '✓' : letters[i]}
                </span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{opt}</span>
              </button>
            );
          })}
        </div>
        {choice !== null && (
          <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.06)', borderLeft: `3px solid ${GOLD}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Explication</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{q.explication}</p>
          </div>
        )}
      </div>
      <Foot page={page} total={total} label="BRVM Academy · quiz" />
    </div>
  );
}
