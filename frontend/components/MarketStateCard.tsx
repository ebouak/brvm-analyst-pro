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

export default function MarketStateCard({ stats }: { stats: MarketStats }) {
  const volPct = stats.volumePrev && stats.volumePrev > 0
    ? ((stats.volumeTotal - stats.volumePrev) / stats.volumePrev) * 100
    : null;
  const volUp = (volPct ?? 0) >= 0;

  const pills = [
    { icon: '🟢', value: stats.hausses, label: 'Hausse',  bg: 'bg-up/10 text-up border border-up/20' },
    { icon: '🔴', value: stats.baisses, label: 'Baisse',  bg: 'bg-down/10 text-down border border-down/20' },
    { icon: '⚪', value: stats.stables, label: 'Stable',  bg: 'bg-muted/10 text-muted border border-border' },
    { icon: '📊', value: stats.total,   label: 'Titres',  bg: 'bg-surface text-white border border-border' },
  ];

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">📊 État du marché</h3>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {pills.map((p) => (
          <div key={p.label} className={`rounded-lg px-2 py-2 text-center ${p.bg}`}>
            <div className="text-lg font-bold tabular leading-none">{p.value}</div>
            <div className="text-[10px] mt-1 opacity-80">{p.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border/50">
        <span>
          Volume total :{' '}
          <span className="tabular text-white/80">{fmtFcfa(stats.volumeTotal)} FCFA</span>
          {volPct != null && (
            <span className={`ml-1 tabular ${volUp ? 'text-up' : 'text-down'}`}>
              {volUp ? '▲' : '▼'}{Math.abs(volPct).toFixed(1)}%
            </span>
          )}
        </span>
        <span>Tx : <span className="tabular text-white/80">{fmtNumber(stats.transactions)}</span></span>
      </div>
    </div>
  );
}
