import type { ActionDaily } from '@/lib/types';
import { fmtNumber } from '@/lib/format';

function Row({ a }: { a: ActionDaily }) {
  const up = (a.variation_pct ?? 0) >= 0;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{a.code}</div>
        <div className="text-xs text-muted truncate">{a.designation}</div>
      </div>
      <div className="text-right">
        <div className="tabular text-sm">{fmtNumber(a.cours_jour)}</div>
        <div className={`tabular text-xs ${up ? 'text-up' : 'text-down'}`}>
          {up ? '+' : ''}
          {(a.variation_pct ?? 0).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

export default function TopMovers({
  title,
  rows,
}: {
  title: string;
  rows: ActionDaily[];
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Aucune donnée</p>
      ) : (
        rows.map((a) => <Row key={a.code} a={a} />)
      )}
    </div>
  );
}
