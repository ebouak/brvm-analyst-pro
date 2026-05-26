import { fmtNumber, fmtFcfa } from '@/lib/format';

export interface IndexCardProps {
  code: string;
  label: string;
  valeur: number | null;
  variation_pct: number | null;
  valeur_echangee?: number | null;
  date_marche?: string | null;
}

export default function IndexCard({ label, valeur, variation_pct, valeur_echangee, date_marche }: IndexCardProps) {
  const up = (variation_pct ?? 0) >= 0;
  const color = variation_pct == null ? 'text-muted' : up ? 'text-up' : 'text-down';
  const arrow = variation_pct == null ? '' : up ? '▲' : '▼';
  const sign  = variation_pct != null && up ? '+' : '';

  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-up/30 transition-colors">
      <div className="text-xs text-muted mb-1 font-medium">{label}</div>
      <div className="tabular text-2xl font-semibold">
        {fmtNumber(valeur, 2)}
      </div>
      <div className={`tabular text-sm mt-1 font-medium ${color}`}>
        {arrow} {sign}{variation_pct?.toFixed(2) ?? '—'}%
      </div>
      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted">
        <span>Vol : <span className="tabular text-white/70">{fmtFcfa(valeur_echangee)} FCFA</span></span>
        {date_marche && <span className="tabular">🕐 {date_marche}</span>}
      </div>
    </div>
  );
}
