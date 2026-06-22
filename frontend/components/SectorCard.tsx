import type React from 'react';
import type { SectorPerf } from '@/lib/sectors';
import { fmtFcfa } from '@/lib/format';
import Link from 'next/link';

interface Props {
  perf: SectorPerf;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const W = 120;
  const H = 28;
  const step = W / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = data[data.length - 1] ?? 0;
  const strokeColor = last >= 0 ? '#3fe18b' : '#ff6b6b';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SectorCard({ perf }: Props) {
  const { secteur, count, varDay, volumeDay, sparkline30d, topHausse, topBaisse, hausses, baisses } = perf;
  const isUp = (varDay ?? 0) >= 0;
  const varColor = varDay == null ? 'text-muted' : isUp ? 'text-up' : 'text-down';
  const borderColor = varDay == null ? 'border-border' : isUp ? 'border-up/20' : 'border-down/20';
  const arrow = varDay == null ? '' : isUp ? '↑' : '↓';
  const varText = varDay == null ? '—' : `${arrow} ${Math.abs(varDay).toFixed(2)}%`;
  const breadth = (hausses + baisses) > 0 ? (hausses / (hausses + baisses)) * 100 : 50;

  return (
    <div className={`rounded-xl border bg-elevated/60 p-4 flex flex-col gap-3 transition-all duration-200 hover:bg-elevated ${borderColor}`}>
      {/* En-tête : nom secteur + variation */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/heatmap?secteur=${encodeURIComponent(secteur)}`}
          className="text-sm font-semibold text-ivory leading-tight hover:text-gold transition-colors"
        >
          {secteur}
        </Link>
        <span className={`tabular text-sm font-bold shrink-0 ${varColor}`}>
          {varText}
        </span>
      </div>

      {/* Breadth bar */}
      <div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-up transition-all [width:var(--breadth)]"
            style={{ '--breadth': `${breadth.toFixed(0)}%` } as React.CSSProperties}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-faint">
          <span>{hausses} hausse{hausses > 1 ? 's' : ''}</span>
          <span>{baisses} baisse{baisses > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Top performers */}
      {(topHausse || topBaisse) && (
        <div className="flex flex-col gap-0.5">
          {topHausse && (
            <div className="flex items-center justify-between text-[11px]">
              <Link
                href={`/actions/${topHausse.code}`}
                className="font-mono font-bold text-up/90 hover:text-up transition-colors"
              >
                ↑ {topHausse.code}
              </Link>
              <span className="tabular text-up">{topHausse.pct >= 0 ? '+' : ''}{topHausse.pct.toFixed(2)}%</span>
            </div>
          )}
          {topBaisse && (
            <div className="flex items-center justify-between text-[11px]">
              <Link
                href={`/actions/${topBaisse.code}`}
                className="font-mono font-bold text-down/90 hover:text-down transition-colors"
              >
                ↓ {topBaisse.code}
              </Link>
              <span className="tabular text-down">{topBaisse.pct.toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-faint">
        <span>{count} action{count > 1 ? 's' : ''} · Vol. {fmtFcfa(volumeDay)}</span>
        <span className="text-[10px]">30j</span>
      </div>

      <Sparkline data={sparkline30d} />

      {/* Navigation contextuelle : voir les actions de ce secteur */}
      <Link
        href={`/actions?secteur=${encodeURIComponent(secteur)}`}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-info hover:underline"
      >
        Voir les actions de ce secteur →
      </Link>
    </div>
  );
}
