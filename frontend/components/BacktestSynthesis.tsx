import type { BacktestSynthesis as Synthesis, BenchmarkSet } from '@/lib/backtest/interpret';

function pct(v: number | null): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

interface Props {
  synthesis: Synthesis;
  strategyReturn: number;
  benchmarks: BenchmarkSet;
}

/** Verdict de synthèse du backtest + comparaison aux repères (best practice analyste). */
export default function BacktestSynthesis({ synthesis, strategyReturn, benchmarks }: Props) {
  const refs: { label: string; value: number | null; highlight?: boolean }[] = [
    { label: 'Stratégie', value: strategyReturn, highlight: true },
    { label: 'Buy & Hold', value: benchmarks.buyHoldReturn },
    { label: 'BRVM-C', value: benchmarks.indexReturn },
    { label: 'Sans risque', value: benchmarks.riskFreeReturn },
  ];

  return (
    <div className="space-y-4">
      {/* Bandeau comparaison */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {refs.map((r) => (
          <div key={r.label} className={`rounded-card border p-3 ${r.highlight ? 'border-gold/30 bg-gold/[0.04]' : 'border-border bg-surface'}`}>
            <p className="text-[10px] uppercase tracking-wider text-faint">{r.label}</p>
            <p className={`tabular mt-1 text-lg font-semibold ${
              r.value == null ? 'text-faint' : r.value >= 0 ? 'text-up' : 'text-down'
            }`}>
              {pct(r.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Verdict */}
      <div className="rounded-card border border-gold/20 bg-elevated/40 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold/70 mb-1.5">Verdict de la stratégie</p>
        <p className="text-sm text-ivory leading-relaxed">{synthesis.verdict}</p>

        {synthesis.cautions.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {synthesis.cautions.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-warn/90">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Détail du raisonnement */}
      <div className="rounded-card border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-faint mb-2">Lecture détaillée</p>
        <ul className="space-y-1.5">
          {synthesis.rationale.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-faint" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-faint italic border-t border-border/50 pt-3">
          Les résultats passés ne préjugent pas des performances futures. Outil informatif.
        </p>
      </div>
    </div>
  );
}
