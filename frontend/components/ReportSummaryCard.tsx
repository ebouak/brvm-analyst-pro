export default function ReportSummaryCard({
  headline,
  why,
  badges,
}: {
  headline: string;
  why?: string[];
  badges?: { label: string; cls: string }[];
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
      <p className="text-sm leading-relaxed">{headline}</p>
      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.label} className={`text-xs border rounded px-2 py-0.5 ${b.cls}`}>{b.label}</span>
          ))}
        </div>
      )}
      {why && why.length > 0 && (
        <ul className="text-xs text-muted list-disc list-inside space-y-0.5">
          {why.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
