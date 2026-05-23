interface Impact {
  retPre: number | null;
  retPost: number | null;
  abnormalReturnPost: number | null;
  volChangePct: number | null;
  reaction: 'positive' | 'neutral' | 'negative';
  horizons: Record<string, number | null>;
}

function pct(n: number | null): string {
  if (n == null) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function cls(n: number | null): string {
  if (n == null) return 'text-muted';
  return n >= 0 ? 'text-up' : 'text-down';
}

export default function EventImpactCard({ code, impact }: { code: string; impact: Impact }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{code}</h3>
        <span className={`text-xs border rounded px-2 py-0.5 ${
          impact.reaction === 'positive' ? 'text-up border-up/40' :
          impact.reaction === 'negative' ? 'text-down border-down/40' : 'text-muted border-border'
        }`}>
          réaction {impact.reaction}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Cell label="Avant (J-5→J0)" value={pct(impact.retPre)} cls={cls(impact.retPre)} />
        <Cell label="Après (J0→J+5)" value={pct(impact.retPost)} cls={cls(impact.retPost)} />
        <Cell label="Excédent vs BRVMC" value={pct(impact.abnormalReturnPost)} cls={cls(impact.abnormalReturnPost)} />
        <Cell label="Δ Volume" value={pct(impact.volChangePct)} cls={cls(impact.volChangePct)} />
      </div>
      <div className="flex gap-3 mt-3 text-xs">
        {Object.entries(impact.horizons).map(([h, v]) => (
          <span key={h} className="tabular">
            <span className="text-muted">{h} </span>
            <span className={cls(v)}>{pct(v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Cell({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`tabular ${cls}`}>{value}</div>
    </div>
  );
}
