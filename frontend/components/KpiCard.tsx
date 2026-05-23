export default function KpiCard({
  label,
  value,
  delta,
  suffix,
}: {
  label: string;
  value: string;
  delta?: number | null;
  suffix?: string;
}) {
  const color =
    delta == null ? 'text-muted' : delta >= 0 ? 'text-up' : 'text-down';
  const sign = delta != null && delta >= 0 ? '+' : '';
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="tabular text-2xl font-medium">
        {value}
        {suffix && <span className="text-sm text-muted ml-1">{suffix}</span>}
      </div>
      {delta != null && (
        <div className={`tabular text-sm mt-1 ${color}`}>
          {sign}
          {delta.toFixed(2)}%
        </div>
      )}
    </div>
  );
}
