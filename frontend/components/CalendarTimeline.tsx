import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { groupByDate, iconForKind, colorForKind, fmtDateLong, type CalendarItem } from '@/lib/calendarHelpers';
import { fmtFcfa } from '@/lib/format';

export default function CalendarTimeline({ items }: { items: CalendarItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted">
        <p className="text-lg mb-2">Aucun événement prévu dans cette période.</p>
        <Link href="/dashboard" className="text-blue hover:underline text-sm">
          <ArrowLeft size={14} aria-hidden className="inline mr-1" />Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const grouped = groupByDate(items);
  const dates = [...grouped.keys()];

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const dayItems = grouped.get(date)!;
        return (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-accent-ink">
                {fmtDateLong(date)}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">{dayItems.length}</span>
            </div>

            <div className="space-y-2">
              {dayItems.map((item) => (
                <CalendarCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarCard({ item }: { item: CalendarItem }) {
  const borderClass = colorForKind(item.kind);
  const Icon = iconForKind(item.kind);

  const inner = (
    <div className={`bg-surface border border-border ${borderClass} rounded-lg px-4 py-3 hover:border-blue/30 transition-colors`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {item.code && (
                <span className="text-xs font-mono font-medium text-ivory shrink-0">{item.code}</span>
              )}
              {item.societe && (
                <span className="text-sm font-medium text-white truncate">{item.societe}</span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">{item.detail}</p>
            {item.datetime && (
              <p className="text-xs text-muted mt-0.5">
                {new Date(item.datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {item.pays ? ` · ${item.pays}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          {item.montant != null && (
            <span className="text-sm font-semibold text-warn tabular">
              +{fmtFcfa(item.montant)} FCFA
            </span>
          )}
          {item.secteur && (
            <p className="text-xs text-muted mt-0.5">{item.secteur}</p>
          )}
          {item.importance != null && item.importance >= 3 && (
            <span className="inline-flex mt-1 gap-0.5 text-warn" aria-label={`Importance ${item.importance} sur 5`}>
              {Array.from({ length: item.importance }, (_, i) => <Star key={i} size={12} fill="currentColor" aria-hidden />)}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{inner}</Link>;
  }
  return inner;
}
