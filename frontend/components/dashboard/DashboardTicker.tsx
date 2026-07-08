'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRealtimeActions } from '@/lib/realtime/useRealtimeActions';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';
import { FlashValue } from '@/components/ui/FlashValue';
import { getPatternsByCode } from '@/lib/patterns/queries';
import type { PatternScreenerData } from '@/lib/patterns/queries';

export interface TickerLine {
  code: string;
  value: string;
  variation: number | null;
  kind: 'action' | 'obligation';
  spark?: number[]; // mini sparkline 5-10 séances
  cours?: number | null; // cours brut (actions) — pour la mise à jour temps réel
}

const nfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

/** Mini sparkline SVG pour le ticker (rendu client). */
function TickerSpark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const w = 36, h = 14;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const stroke = up ? '#3fe18b' : '#ff6b6b';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 opacity-70">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Bandeau de cours en défilement permanent (actions + obligations).
 *  Si `dateMarche` est fourni, les lignes ACTIONS se mettent à jour en temps
 *  réel (Supabase Realtime) avec flash ; les obligations restent statiques
 *  (hors périmètre Realtime). */
export default function DashboardTicker({
  items,
  dateMarche,
}: {
  items: TickerLine[];
  dateMarche?: string | null;
}) {
  // Seed du hook : uniquement les lignes actions ayant un cours brut.
  const actionSeed: RealtimeActionRow[] = items
    .filter((it) => it.kind === 'action' && it.cours != null)
    .map((it) => ({ code: it.code, cours_jour: it.cours ?? null, variation_pct: it.variation }));
  const { rows: liveRows, flashes } = useRealtimeActions(actionSeed, dateMarche ?? null);
  const liveByCode = new Map(liveRows.map((r) => [r.code, r]));

  // Fetch patterns for action items to show badges
  const [patternsByCode, setPatternsByCode] = useState<Record<string, PatternScreenerData[]>>({});
  const [patternsLoading, setPatternsLoading] = useState(false);

  useEffect(() => {
    const loadPatterns = async () => {
      if (!dateMarche) return;
      try {
        setPatternsLoading(true);
        const actionCodes = items.filter((it) => it.kind === 'action').map((it) => it.code);
        if (actionCodes.length === 0) return;
        const patterns = await getPatternsByCode(actionCodes, dateMarche);
        setPatternsByCode(patterns);
      } catch (err) {
        console.error('Error fetching ticker patterns:', err);
      } finally {
        setPatternsLoading(false);
      }
    };

    loadPatterns();
    const interval = setInterval(loadPatterns, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [items, dateMarche]);

  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div
      className="group relative overflow-hidden rounded-full border border-border bg-surface/70 py-2 shadow-card"
      role="marquee"
      aria-label="Cours des actions et obligations en défilement"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent" />
      <div className="flex w-max animate-ticker items-center gap-6 px-6 font-mono group-hover:[animation-play-state:paused]">
        {loop.map((it, i) => {
          // Pour les actions, on superpose la donnée temps réel si disponible.
          const live = it.kind === 'action' ? liveByCode.get(it.code) : undefined;
          const variation = live ? live.variation_pct : it.variation;
          const value = live && live.cours_jour != null ? nfmt(live.cours_jour) : it.value;
          const up = (variation ?? 0) >= 0;
          const flashDir = it.kind === 'action' ? (flashes[it.code] ?? 'none') : 'none';
          // Pastille de section au début et à chaque changement Actions↔Obligations.
          const showLabel = i === 0 || loop[i - 1]!.kind !== it.kind;
          return (
            <span key={`seg-${it.code}-${i}`} className="contents">
            {showLabel && (
              <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                it.kind === 'action' ? 'border-info/40 bg-info/10 text-info' : 'border-gold/40 bg-gold/10 text-gold'
              }`}>
                {it.kind === 'action' ? '◆ Actions' : '◆ Obligations'}
              </span>
            )}
            <Link
              href={it.kind === 'action' ? `/actions/${it.code}` : '/obligations'}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold transition-opacity hover:opacity-100"
            >
              <span className="text-muted">{it.code}</span>
              {/* Pattern badges for actions */}
              {it.kind === 'action' && patternsByCode[it.code] && patternsByCode[it.code].length > 0 && (
                <span className="inline-flex gap-0.5">
                  {patternsByCode[it.code].some((p) => p.pattern_type === 'atr_extreme') && (
                    <span className="text-[9px] bg-up/20 text-up px-1 py-0.5 rounded font-medium">⚡</span>
                  )}
                  {patternsByCode[it.code].some((p) => p.pattern_type === 'bullish_consolidation') && (
                    <span className="text-[9px] bg-info/20 text-info px-1 py-0.5 rounded font-medium">📊</span>
                  )}
                  {patternsByCode[it.code].some((p) => p.pattern_type === 'breakout_impulse') && (
                    <span className="text-[9px] bg-accent/20 text-accent px-1 py-0.5 rounded font-medium">🚀</span>
                  )}
                </span>
              )}
              {it.kind === 'action' && it.spark && <TickerSpark data={it.spark} up={up} />}
              <FlashValue direction={flashDir} className="text-ivory">{value}</FlashValue>
              {variation != null && (
                <span className={up ? 'text-up' : 'text-down'}>
                  {up ? '+' : ''}{variation.toFixed(2)}%
                </span>
              )}
            </Link>
            </span>
          );
        })}
      </div>
    </div>
  );
}
