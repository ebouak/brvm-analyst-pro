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
  const iconColor = neutral ? 'text-muted' : up ? 'text-up' : 'text-down';

  // Sparkline SVG miniature (40×20)
  const sparkSvg = sparkline && sparkline.length >= 2 ? (() => {
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const w = 80, h = 24;
    const pts = sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
    const lastColor = (sparkline[sparkline.length - 1]! >= sparkline[0]!) ? '#00c853' : '#f44336';
    return { pts, lastColor, w, h };
  })() : null;

  const displayDate = date_seance
    ? fmtDateTimeFR(date_seance)
    : date_marche ?? null;

  return (
    <div className="bg-surface border border-border hover:border-up/40 rounded-xl p-4 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-muted font-medium">{label}</span>
        <Icon size={16} className={`${iconColor} opacity-70 group-hover:opacity-100 transition-opacity`} />
      </div>

      {/* Valeur principale */}
      <div className="tabular text-2xl font-semibold leading-tight">
        {fmtNumber(valeur, 2)}
      </div>

      {/* Variation */}
      <div className={`tabular text-sm mt-1 font-medium ${color} flex items-center gap-1`}>
        {!neutral && <Icon size={12} />}
        {sign}{variation_pct?.toFixed(2) ?? '—'}%
      </div>

      {/* Sparkline */}
      {sparkSvg && (
        <div className="mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
          <svg viewBox={`0 0 ${sparkSvg.w} ${sparkSvg.h}`} width="100%" height={sparkSvg.h} preserveAspectRatio="none">
            <polyline
              points={sparkSvg.pts}
              fill="none"
              stroke={sparkSvg.lastColor}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted">
        <span>
          Vol :{' '}
          <span className="tabular text-white/70">{fmtFcfa(valeur_echangee)} FCFA</span>
        </span>
        {displayDate && (
          <span className="tabular text-faint">MàJ : {displayDate}</span>
        )}
      </div>
    </div>
  );
}
