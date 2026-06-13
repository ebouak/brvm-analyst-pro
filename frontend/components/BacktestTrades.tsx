import type { Trade } from '@/lib/backtest';

function pct(v: number | null): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

interface Props {
  trades: Trade[];
  bestTradePct: number | null;
  worstTradePct: number | null;
}

/**
 * Tableau trade par trade : relie le backtest aux signaux (chaque ligne = un
 * aller-retour déclenché par BUY puis SELL).
 */
export default function BacktestTrades({ trades, bestTradePct, worstTradePct }: Props) {
  if (trades.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-sm text-muted">Aucun trade sur la période.</p>
        <p className="mt-1 text-xs text-faint">La stratégie n’a déclenché aucun aller-retour (BUY → SELL).</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-ivory">Trades ({trades.length})</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted">Meilleur <span className="tabular text-up font-semibold">{pct(bestTradePct)}</span></span>
          <span className="text-muted">Pire <span className="tabular text-down font-semibold">{pct(worstTradePct)}</span></span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border">
            <tr>
              <th className="text-left px-2 py-2 font-medium">#</th>
              <th className="text-left px-2 py-2 font-medium">Entrée (BUY)</th>
              <th className="text-left px-2 py-2 font-medium">Sortie (SELL)</th>
              <th className="text-right px-2 py-2 font-medium">Durée</th>
              <th className="text-right px-2 py-2 font-medium">Rendement</th>
              <th className="text-right px-2 py-2 font-medium">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-bg/20' : ''}`}>
                <td className="px-2 py-2 tabular text-faint">{i + 1}</td>
                <td className="px-2 py-2 tabular text-xs text-ivory">{t.entryDate ?? `#${t.entryIndex}`}</td>
                <td className="px-2 py-2 tabular text-xs text-ivory">
                  {t.exitDate ?? (t.exitIndex == null ? 'en cours' : `#${t.exitIndex}`)}
                </td>
                <td className="px-2 py-2 text-right tabular text-xs text-muted">{t.bars != null ? `${t.bars} j` : '—'}</td>
                <td className={`px-2 py-2 text-right tabular font-semibold ${(t.returnPct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                  {pct(t.returnPct)}
                </td>
                <td className="px-2 py-2 text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    t.win ? 'bg-up/10 text-up' : 'bg-down/10 text-down'
                  }`}>
                    {t.exitIndex == null ? 'latent' : t.win ? 'gagnant' : 'perdant'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
