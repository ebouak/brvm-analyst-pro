import { BarChart3, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { fmtFcfa, fmtNumber } from '@/lib/format';

export interface MarketStats {
  hausses: number;
  baisses: number;
  stables: number;
  total: number;
  volumeTotal: number;
  volumePrev: number | null;
  transactions: number;
}

function BreadthBadge({ ratio }: { ratio: number }) {
  const color = ratio >= 60 ? 'text-up border-up/30 bg-up/10'
    : ratio <= 40 ? 'text-down border-down/30 bg-down/10'
    : 'text-warn border-warn/30 bg-warn/10';
  const label = ratio >= 60 ? 'Haussier' : ratio <= 40 ? 'Baissier' : 'Neutre';
  return (
    <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 tabular ${color}`}>
      {label} {ratio.toFixed(0)}%
    </span>
  );
}

export default function MarketStateCard({ stats }: { stats: MarketStats }) {
  const volPct = stats.volumePrev && stats.volumePrev > 0
    ? ((stats.volumeTotal - stats.volumePrev) / stats.volumePrev) * 100
    : null;
  const volUp = (volPct ?? 0) >= 0;

  const breadth = stats.hausses + stats.baisses > 0
    ? (stats.hausses / (stats.hausses + stats.baisses)) * 100
    : 50;

  const pills = [
    {
      icon: <TrendingUp size={14} />,
      value: stats.hausses,
      label: 'Hausse',
      cls: 'bg-up/10 text-up border border-up/20 hover:bg-up/15',
    },
    {
      icon: <TrendingDown size={14} />,
      value: stats.baisses,
      label: 'Baisse',
      cls: 'bg-down/10 text-down border border-down/20 hover:bg-down/15',
    },
    {
      icon: <Minus size={14} />,
      value: stats.stables,
      label: 'Stable',
      cls: 'bg-muted/10 text-muted border border-border hover:bg-muted/15',
    },
    {
      icon: <Activity size={14} />,
      value: stats.total,
      label: 'Titres',
      cls: 'bg-surface text-white/80 border border-border hover:border-border/80',
    },
  ];

  // Barre de breadth empilée
  const hPct  = stats.total > 0 ? (stats.hausses / stats.total) * 100 : 0;
  const bPct  = stats.total > 0 ? (stats.baisses / stats.total) * 100 : 0;
  const sPct  = Math.max(0, 100 - hPct - bPct);

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Activity size={14} className="text-muted" />
          État du marché
        </h3>
        {stats.hausses + stats.baisses > 0 && <BreadthBadge ratio={breadth} />}
      </div>

      {/* Pills */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {pills.map((p) => (
          <div
            key={p.label}
            className={`rounded-lg px-2 py-2.5 text-center transition-colors cursor-default ${p.cls}`}
          >
            <div className="flex justify-center mb-1 opacity-70">{p.icon}</div>
            <div className="text-base font-bold tabular leading-none">{p.value}</div>
            <div className="text-[10px] mt-1 opacity-70">{p.label}</div>
          </div>
        ))}
      </div>

      {/* Barre empilée breadth */}
      {stats.total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-px">
          <div className="bg-up/70 transition-all" style={{ width: `${hPct}%` }} />
          <div className="bg-muted/40 transition-all" style={{ width: `${sPct}%` }} />
          <div className="bg-down/70 transition-all" style={{ width: `${bPct}%` }} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border/50">
        <span>
          Volume :{' '}
          <span className="tabular text-white/80">{fmtFcfa(stats.volumeTotal)} FCFA</span>
          {volPct != null && (
            <span className={`ml-1 tabular ${volUp ? 'text-up' : 'text-down'}`}>
              {volUp ? '▲' : '▼'}{Math.abs(volPct).toFixed(1)}%
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <BarChart3 size={11} />
          Tx : <span className="tabular text-white/80 ml-0.5">{fmtNumber(stats.transactions)}</span>
        </span>
      </div>
    </div>
  );
}
