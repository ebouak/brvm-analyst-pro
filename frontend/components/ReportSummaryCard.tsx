export default function ReportSummaryCard({
  headline,
  why,
  badges,
  whyTitle,
}: {
  headline: string;
  why?: string[];
  badges?: { label: string; cls: string }[];
  /** Intitulé du bloc de constats. Omis, la liste reste en puces discrètes
   *  (rendu historique du rapport instrument). */
  whyTitle?: string;
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
        <div className={whyTitle ? 'pt-2 mt-1 border-t border-border/60 space-y-1.5' : undefined}>
          {whyTitle && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">{whyTitle}</h2>
          )}
          <ul className={`list-disc list-inside space-y-1 ${whyTitle ? 'text-sm leading-relaxed text-white/80' : 'text-xs text-muted space-y-0.5'}`}>
            {why.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
