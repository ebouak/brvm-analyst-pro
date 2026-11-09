import type { BacktestTrade } from '@/types/backtest';
import { formatPercent, formatDate } from '@/lib/backtest-formatters';

const STATUS: Record<BacktestTrade['result'], { label: string; cls: string }> = {
  winner: { label: 'Gagnant', cls: 'bg-up/5 text-up border-up/30' },
  loser: { label: 'Perdant', cls: 'bg-down/5 text-down border-down/30' },
  open: { label: 'En cours', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
};

export function BacktestTradesMiniTable({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) return null;
  return (
    <section className="rounded-xl border border-gray-200 bg-[#ffffff] p-4 sm:p-5">
      <p className="mb-3 text-xs font-semibold text-gray-400">Détail des trades</p>
      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
              <th className="py-2 pr-3 font-medium">Entrée</th>
              <th className="py-2 pr-3 font-medium">Sortie</th>
              <th className="py-2 pr-3 text-right font-medium">Durée</th>
              <th className="py-2 pr-3 text-right font-medium">Rendement</th>
              <th className="py-2 text-right font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 text-gray-700">{formatDate(t.entryDate)}</td>
                <td className="py-2 pr-3 text-gray-700">{t.exitDate ? formatDate(t.exitDate) : '—'}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-500">{t.durationDays} j</td>
                <td className={`py-2 pr-3 text-right font-medium tabular-nums ${t.returnPct >= 0 ? 'text-up' : 'text-down'}`}>
                  {formatPercent(t.returnPct)}
                </td>
                <td className="py-2 text-right">
                  <span
                    aria-label={`Trade ${STATUS[t.result].label.toLowerCase()}`}
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS[t.result].cls}`}
                  >
                    {STATUS[t.result].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
