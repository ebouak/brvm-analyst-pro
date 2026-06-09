import Link from 'next/link';
import { TrendingUp, TrendingDown } from '@/components/icons';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { fmtNumber } from '@/lib/format';
import SignalBadge from '@/components/SignalBadge';

function RankCircle({ n, direction }: { n: number; direction?: 'up' | 'down' }) {
  const cls = direction === 'up'
    ? 'border-up/20 bg-up/[0.06] text-up/70'
    : direction === 'down'
    ? 'border-down/20 bg-down/[0.06] text-down/70'
    : 'border-border bg-elevated text-muted';
  return (
    <span
      className={`
        inline-flex items-center justify-center w-6 h-6 rounded-full border
        text-[10px] font-bold shrink-0 ${cls}
      `}
    >
      {n}
    </span>
  );
}

function CountryBadge({ pays }: { pays: string | null | undefined }) {
  if (!pays) return null;
  return (
    <span className="hidden sm:inline-block text-[9px] font-semibold tracking-wider border border-border rounded-sm px-1 py-px text-faint uppercase leading-none">
      {pays.slice(0, 2)}
    </span>
  );
}

function Row({
  rank,
  a,
  signal,
  direction,
}: {
  rank: number;
  a: ActionDaily;
  signal?: SignalDaily | null;
  direction?: 'up' | 'down';
}) {
  const up = (a.variation_pct ?? 0) >= 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <Link
      href={`/actions/${encodeURIComponent(a.code)}`}
      className="
        group flex items-center gap-3 py-2.5 px-3 rounded-card
        border border-transparent
        hover:bg-elevated hover:border-border/50
        transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
      "
    >
      <RankCircle n={rank} direction={direction} />

      {/* Code + désignation */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-ivory">{a.code}</span>
          <CountryBadge pays={a.pays} />
        </div>
        <div className="text-[11px] text-faint truncate hidden sm:block max-w-[130px] mt-px">
          {a.designation ?? '—'}
        </div>
      </div>

      {/* Signal badge */}
      <div className="hidden md:block shrink-0">
        {signal ? (
          <SignalBadge signal={signal.signal} confiance={signal.confiance} />
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </div>

      {/* Cours + variation */}
      <div className="text-right shrink-0 ml-auto">
        <div className="tabular text-sm font-semibold text-ivory">{fmtNumber(a.cours_jour)}</div>
        <div
          className={`
            tabular text-[11px] font-medium flex items-center justify-end gap-0.5 mt-px
            ${up ? 'text-up' : 'text-down'}
          `}
        >
          <Icon size={10} />
          {up ? '+' : ''}{(a.variation_pct ?? 0).toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}

export default function TopMovers({
  title,
  rows,
  signals = [],
  direction,
}: {
  title: string;
  rows: ActionDaily[];
  signals?: SignalDaily[];
  direction?: 'up' | 'down';
}) {
  const sigMap = new Map(signals.map((s) => [s.code, s]));
  const accentBar = direction === 'up'
    ? 'border-l-up/40'
    : direction === 'down'
    ? 'border-l-down/40'
    : 'border-l-border';

  return (
    /* Outer shell */
    <div className="rounded-panel border border-border bg-border/30 p-1.5">
      {/* Inner core */}
      <div
        className={`
          rounded-[calc(1.125rem-0.375rem)] bg-surface
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]
          border-l-2 ${accentBar}
          px-2 py-4
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 mb-3">
          <span
            className={`
              grid h-5 w-5 place-items-center rounded-full border text-[10px]
              ${direction === 'up'
                ? 'border-up/25 bg-up/10 text-up'
                : direction === 'down'
                ? 'border-down/25 bg-down/10 text-down'
                : 'border-border bg-elevated text-muted'
              }
            `}
          >
            {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '•'}
          </span>
          <h3 className="text-sm font-semibold text-ivory">{title}</h3>
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-faint">Aucune donnée disponible.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {rows.map((a, i) => (
              <Row key={a.code} rank={i + 1} a={a} signal={sigMap.get(a.code)} direction={direction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
