import type { FundamentalRatios } from '@/lib/financials/types';
import { computeValuation, VERDICT_LABELS } from '@/lib/financials/valuation';

interface FundaRow {
  code: string;
  designation: string | null;
  ratios: FundamentalRatios;
  coursActuel: number | null;
  fcf: number | null;
  shares: number | null;
  perfPct?: number | null; // performance sur la période sélectionnée
}

export default function CompareVerdict({ rows }: { rows: FundaRow[] }) {
  if (rows.length < 2) return null;

  // Score composite : valuation + performance période
  const scored = rows.map((r) => {
    const val = computeValuation(r.ratios, r.coursActuel, r.fcf, r.shares);
    const valScore = val.scoreValorisation ?? 50;
    const perfScore = r.perfPct != null
      ? Math.max(0, Math.min(100, 50 + r.perfPct * 2))
      : 50;
    const total = valScore * 0.6 + perfScore * 0.4;
    return { code: r.code, designation: r.designation, total, verdict: val.verdict };
  }).sort((a, b) => b.total - a.total);

  const winner = scored[0]!;

  return (
    <div className="bg-surface border border-cyan/20 rounded-xl p-4 space-y-3">
      <span className="text-[10px] text-cyan uppercase tracking-wide font-bold">Verdict comparatif</span>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-2xl">🏆</span>
        <div>
          <p className="text-sm font-semibold text-ivory">
            {winner.code}{winner.designation ? ` — ${winner.designation}` : ''}
          </p>
          <p className="text-xs text-muted">
            Meilleur profil sur la période · valorisation <span className="text-ivory">{VERDICT_LABELS[winner.verdict]}</span>
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        {scored.map((s, rank) => (
          <div key={s.code} className="flex items-center gap-2">
            <span className="text-[10px] text-faint w-4">{rank + 1}.</span>
            <span className="text-xs text-ivory font-medium w-16">{s.code}</span>
            <div className="flex-1 bg-border rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-cyan transition-all"
                style={{ width: `${s.total.toFixed(0)}%` }}
              />
            </div>
            <span className="text-[10px] text-faint tabular w-8 text-right">{s.total.toFixed(0)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-faint italic">Score = 60% valorisation fondamentale + 40% performance sur la période. Aucun conseil d'investissement.</p>
    </div>
  );
}
