import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { fmtNumber } from '@/lib/format';
import SignalBadge from '@/components/SignalBadge';

function RankCircle({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-border/60 text-[10px] font-semibold text-muted shrink-0">
      {n}
    </span>
  );
}

function CountryBadge({ pays }: { pays: string | null | undefined }) {
  if (!pays) return null;
  return (
    <span className="hidden sm:inline-block text-[10px] border border-border rounded px-1 py-0.5 text-faint leading-none">
      {pays.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Row({
  rank,
  a,
  signal,
}: {
  rank: number;
  a: ActionDaily;
  signal?: SignalDaily | null;
}) {
  const up = (a.variation_pct ?? 0) >= 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <Link
      href={`/actions/${encodeURIComponent(a.code)}`}
      className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-elevated transition-colors border border-transparent hover:border-border/40"
    >
      <RankCircle n={rank} />

      {/* Code + désignation */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">{a.code}</span>
          <CountryBadge pays={a.pays} />
        </div>
        <div className="text-xs text-muted truncate hidden sm:block max-w-[120px]">
          {a.designation ?? '—'}
        </div>
      </div>

      {/* Signal badge — masqué mobile */}
      <div className="hidden md:block shrink-0">
        {signal ? (
          <SignalBadge signal={signal.signal} confiance={signal.confiance} />
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </div>

      {/* Cours + variation */}
      <div className="text-right shrink-0">
        <div className="tabular text-sm font-medium">{fmtNumber(a.cours_jour)}</div>
        <div className={`tabular text-xs flex items-center justify-end gap-0.5 ${up ? 'text-up' : 'text-down'}`}>
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
}: {
  title: string;
  rows: ActionDaily[];
  signals?: SignalDaily[];
}) {
  const sigMap = new Map(signals.map((s) => [s.code, s]));

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted py-4 text-center">Aucune donnée disponible.</p>
      ) : (
        <div className="space-y-0.5">
          {rows.map((a, i) => (
            <Row key={a.code} rank={i + 1} a={a} signal={sigMap.get(a.code)} />
          ))}
        </div>
      )}
    </div>
  );
}
