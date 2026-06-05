'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fmtNumber } from '@/lib/format';

interface Quote {
  date_marche: string;
  cours_jour: number | null;
  cours_precedent: number | null;
  variation_pct: number | null;
  volume: number | null;
}

/**
 * Modale d'historique des cours d'une action : cours du jour + 60 dernières
 * séances (mini-graphe SVG + tableau). Lecture Supabase (anon, RLS publique).
 */
export default function PriceHistoryModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour, cours_precedent, variation_pct, volume')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setQuotes((data ?? []) as Quote[]);
      });
    return () => { cancelled = true; };
  }, [code]);

  // Série chronologique (ancien → récent) des cours non nuls, pour le graphe.
  const series = useMemo<number[]>(() => {
    if (!quotes) return [];
    return [...quotes]
      .reverse()
      .map((q) => q.cours_jour)
      .filter((c): c is number => c != null);
  }, [quotes]);

  const last = quotes?.[0] ?? null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">📈 Historique des cours — {code}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg text-lg" aria-label="Fermer">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && <p className="text-down text-sm">Erreur : {error}</p>}
          {!quotes && !error && <p className="text-muted text-sm">Chargement…</p>}
          {quotes && quotes.length === 0 && (
            <p className="text-muted text-sm">Aucun cours disponible pour {code}.</p>
          )}

          {last && (
            <>
              {/* Cours du jour */}
              <div className="bg-bg/40 border border-border rounded-lg p-4">
                <div className="text-xs text-muted mb-1">Dernier cours connu — {last.date_marche}</div>
                <div className="flex items-end gap-3">
                  <span className="tabular text-2xl font-bold">{fmtNumber(last.cours_jour)} FCFA</span>
                  {last.variation_pct != null && (
                    <span className={`tabular text-sm pb-1 ${last.variation_pct >= 0 ? 'text-up' : 'text-down'}`}>
                      {last.variation_pct >= 0 ? '▲ +' : '▼ '}{last.variation_pct.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted mt-1">
                  Clôture précédente : <span className="tabular">{fmtNumber(last.cours_precedent)} FCFA</span>
                </div>
              </div>

              {/* Mini-graphe SVG */}
              {series.length > 1 && <Sparkline points={series} />}

              {/* Tableau des séances */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted border-b border-border bg-bg/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Cours</th>
                      <th className="px-3 py-2 text-right">Variation</th>
                      <th className="px-3 py-2 text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes!.map((q) => (
                      <tr key={q.date_marche} className="border-b border-border/40 hover:bg-bg/40">
                        <td className="px-3 py-1.5">{q.date_marche}</td>
                        <td className="px-3 py-1.5 text-right tabular">{fmtNumber(q.cours_jour)}</td>
                        <td className={`px-3 py-1.5 text-right tabular ${q.variation_pct == null ? 'text-muted' : q.variation_pct >= 0 ? 'text-up' : 'text-down'}`}>
                          {q.variation_pct != null ? `${q.variation_pct >= 0 ? '+' : ''}${q.variation_pct.toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular text-muted">{q.volume != null ? fmtNumber(q.volume) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Link href={`/actions/${code}`} className="text-xs text-up hover:underline block text-center">
                Voir la fiche complète (RSI, MACD, MA) →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mini-graphe en aire (SVG pur, sans dépendance). */
function Sparkline({ points }: { points: number[] }) {
  const w = 600;
  const h = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const coords = points.map((p, i) => [i * stepX, h - ((p - min) / range) * (h - 10) - 5]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const up = points[points.length - 1] >= points[0];
  const color = up ? '#00c853' : '#f44336';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32 bg-bg/40 border border-border rounded-lg" preserveAspectRatio="none">
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
