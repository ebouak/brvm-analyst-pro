'use client';
import { TrendingUp, TrendingDown, Minus } from '@/components/icons';
import { fmtNumber, fmtFcfa, fmtDateTimeFR } from '@/lib/format';

export interface IndexCardProps {
  code: string;
  label: string;
  valeur: number | null;
  variation_pct: number | null;
  valeur_echangee?: number | null;
  date_marche?: string | null;
  /** ISO date string de la séance ex: "2026-05-26" */
  date_seance?: string | null;
  /** Sparkline 7j — cours de clôture du plus ancien au plus récent */
  sparkline?: number[];
}

export default function IndexCard({
  label,
  valeur,
  variation_pct,
  valeur_echangee,
  date_marche,
  date_seance,
  sparkline,
}: IndexCardProps) {
  const up      = (variation_pct ?? 0) > 0;
  const neutral = variation_pct == null || variation_pct === 0;
  const color   = neutral ? 'text-muted' : up ? 'text-up' : 'text-down';
  const sign    = !neutral && up ? '+' : '';

  const Icon = neutral ? Minus : up ? TrendingUp : TrendingDown;

  const sparkSvg = sparkline && sparkline.length >= 2 ? (() => {
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const w = 120, h = 32;
    const pts = sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const trending = (sparkline[sparkline.length - 1]! >= sparkline[0]!);
    const lineColor = trending ? '#16b46a' : '#e24b4b';
    const fillId = `spark-fill-${label.replace(/\s/g, '')}`;
    return { pts, lineColor, fillId, w, h };
  })() : null;

  const displayDate = date_seance
    ? fmtDateTimeFR(date_seance)
    : date_marche ?? null;

  return (
    /* Outer shell — double-bezel */
    <div
      className={`
        rounded-panel p-1.5 border transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${up && !neutral
          ? 'border-up/20 bg-up/[0.03] hover:border-up/40 hover:shadow-emerald'
          : neutral
          ? 'border-border bg-border/30 hover:border-border-strong'
          : 'border-down/20 bg-down/[0.03] hover:border-down/30'
        }
        group
      `}
    >
      {/* Inner core */}
      <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">

        {/* Header row */}
        <div className="flex items-start justify-between mb-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted">{label}</p>
          <span
            className={`
              grid h-7 w-7 place-items-center rounded-full border transition-all duration-300
              ${neutral
                ? 'border-border bg-elevated text-muted'
                : up
                ? 'border-up/25 bg-up/10 text-up'
                : 'border-down/25 bg-down/10 text-down'
              }
            `}
          >
            <Icon size={13} />
          </span>
        </div>

        {/* Valeur principale */}
        <div className="tabular text-[2rem] font-semibold text-ivory leading-none tracking-tight mt-3">
          {fmtNumber(valeur, 2)}
        </div>

        {/* Variation pill */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className={`
              inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular
              ${neutral
                ? 'border-border bg-elevated text-muted'
                : up
                ? 'border-up/30 bg-up/10 text-up'
                : 'border-down/30 bg-down/10 text-down'
              }
            `}
          >
            <Icon size={10} />
            {sign}{variation_pct?.toFixed(2) ?? '—'}%
          </span>
        </div>

        {/* Sparkline premium */}
        {sparkSvg && (
          <div className="mt-4 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
            <svg
              viewBox={`0 0 ${sparkSvg.w} ${sparkSvg.h}`}
              width="100%"
              height={sparkSvg.h}
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id={sparkSvg.fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkSvg.lineColor} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={sparkSvg.lineColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={`0,${sparkSvg.h} ${sparkSvg.pts} ${sparkSvg.w},${sparkSvg.h}`}
                fill={`url(#${sparkSvg.fillId})`}
              />
              <polyline
                points={sparkSvg.pts}
                fill="none"
                stroke={sparkSvg.lineColor}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
          <span className="text-[11px] text-muted">
            Vol{' '}
            <span className="tabular text-ivory/70 font-medium">{fmtFcfa(valeur_echangee)} FCFA</span>
          </span>
          {displayDate && (
            <span className="tabular text-[10px] text-faint">{displayDate}</span>
          )}
        </div>

      </div>
    </div>
  );
}
