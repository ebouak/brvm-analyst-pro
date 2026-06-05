import { fmtNumber } from '@/lib/format';

interface Props {
  title: string;
  low: number | null;
  high: number | null;
  current: number | null;
}

/** Range Haut/Bas avec curseur de position (inspiré Trading 212), dark finance. */
export default function RangeBar({ title, low, high, current }: Props) {
  const pos =
    low != null && high != null && current != null && high > low
      ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
      : null;
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-muted mb-3">{title}</div>
      <div className="flex items-center gap-3">
        <div className="text-xs">
          <div className="text-muted">Bas</div>
          <div className="tabular">{low != null ? fmtNumber(low) : '—'}</div>
        </div>
        <div className="relative flex-1 h-1.5 bg-border rounded-full">
          {pos != null && (
            <div
              className="absolute -top-1 w-3 h-3 rounded-full bg-up border-2 border-surface"
              style={{ left: `calc(${pos}% - 6px)` }}
            />
          )}
        </div>
        <div className="text-xs text-right">
          <div className="text-muted">Haut</div>
          <div className="tabular">{high != null ? fmtNumber(high) : '—'}</div>
        </div>
      </div>
    </div>
  );
}
