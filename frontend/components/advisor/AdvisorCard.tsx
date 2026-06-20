'use client';

import { useState } from 'react';
import Link from 'next/link';
import Sparkline from '@/components/Sparkline';
import { fmtNumber } from '@/lib/format';
import type { AdvisorRow } from '@/lib/advisor/server';
import type { Action } from '@/lib/advisor/recommend';

const LABEL: Record<Action, string> = { acheter: 'Acheter', conserver: 'Conserver', vendre: 'Vendre' };
const BADGE: Record<Action, string> = {
  acheter: 'bg-up/15 text-up border-up/30',
  conserver: 'bg-gold/10 text-gold border-gold/25',
  vendre: 'bg-down/15 text-down border-down/30',
};
const BAR: Record<Action, string> = { acheter: 'bg-up', conserver: 'bg-gold', vendre: 'bg-down' };

export function AdvisorCard({ row }: { row: AdvisorRow }) {
  const [flipped, setFlipped] = useState(false);
  const { result } = row;
  const trendUp = row.sparkline.length >= 2 && row.sparkline[row.sparkline.length - 1]! >= row.sparkline[0]!;
  const maxAbs = Math.max(1, ...result.breakdown.map((b) => Math.abs(b.points)));

  return (
    <div className="h-56 [perspective:1200px]">
      <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
        {/* ── FRONT : synthèse ── */}
        <button
          type="button"
          onClick={() => setFlipped(true)}
          aria-label={`Voir le détail de la recommandation ${row.code}`}
          className="absolute inset-0 flex flex-col rounded-xl border border-border bg-surface p-4 text-left [backface-visibility:hidden] transition hover:border-info/40"
        >
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${BADGE[result.action]}`}>{LABEL[result.action]}</span>
            <span className="font-semibold text-white">{row.code}</span>
            <span className="ml-auto text-[11px] text-faint">détails ↻</span>
          </div>
          {row.designation && <p className="mt-0.5 text-xs text-muted line-clamp-1">{row.designation}</p>}

          <div className="my-2 flex-1 flex items-center">
            {row.sparkline.length >= 2 ? (
              <Sparkline data={row.sparkline} up={trendUp} width={150} height={40} />
            ) : (
              <span className="text-xs text-faint">Tendance indisponible</span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-faint">Conviction</span>
              <span className="tabular text-white">{result.conviction}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
              <span className={`block h-full ${BAR[result.action]}`} style={{ width: `${result.conviction}%` }} />
            </div>
            <p className="mt-1.5 tabular text-sm text-white">{row.cours != null ? `${fmtNumber(row.cours)} FCFA` : '—'}</p>
          </div>
        </button>

        {/* ── BACK : justification détaillée ── */}
        <div className="absolute inset-0 flex flex-col rounded-xl border border-info/30 bg-elevated p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{row.code} — pourquoi&nbsp;?</span>
            <button type="button" onClick={() => setFlipped(false)} className="text-[11px] text-faint hover:text-white">↩ retour</button>
          </div>

          <div className="mt-2 flex-1 space-y-2.5 overflow-y-auto">
            {/* Explication en clair (débutant) */}
            <p className="text-[11px] leading-relaxed text-white/90">{result.narrative}</p>

            <div className="border-t border-border/50 pt-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-faint">Détail du calcul</p>
            </div>

            {result.breakdown.map((b, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{b.label}</span>
                  <span className={`tabular font-semibold ${b.points > 0 ? 'text-up' : b.points < 0 ? 'text-down' : 'text-faint'}`}>
                    {b.points > 0 ? '+' : ''}{b.points}
                  </span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-border">
                  <span
                    className={`block h-full ${b.points > 0 ? 'bg-up' : b.points < 0 ? 'bg-down' : 'bg-faint'}`}
                    style={{ width: `${(Math.abs(b.points) / maxAbs) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-faint">{b.detail}</p>
              </div>
            ))}
            {result.breakdown.length === 0 && (
              <p className="text-xs text-faint">Données insuffisantes pour argumenter.</p>
            )}
          </div>

          <Link href={`/actions/${row.code}`} className="mt-2 text-xs text-info hover:underline">
            Voir la fiche complète →
          </Link>
        </div>
      </div>
    </div>
  );
}
