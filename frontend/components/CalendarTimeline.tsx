import Link from 'next/link';
import { groupByDate, iconForKind, libelleType, montantDividende, fmtDateLong, type CalendarItem } from '@/lib/calendarHelpers';

/**
 * Chronologie du calendrier : un jour par bloc, la date à gauche, les éléments
 * à droite. Le type est écrit en clair (plus de code couleur ni de légende) ; un
 * dividende par action s'affiche au centime, sans « + » : ce n'est pas un gain.
 */
export default function CalendarTimeline({ items }: { items: CalendarItem[] }) {
  if (items.length === 0) return null;

  const grouped = groupByDate(items);
  const dates = [...grouped.keys()];

  return (
    <ol className="divide-y divide-border/60 rounded-card border border-border bg-surface">
      {dates.map((date) => {
        const dayItems = grouped.get(date)!;
        return (
          <li key={date} className="grid gap-x-6 gap-y-2 px-4 py-4 md:grid-cols-[140px_minmax(0,1fr)] md:px-5">
            <time dateTime={date} className="tabular text-sm text-ivory md:pt-2.5">{fmtDateLong(date)}</time>
            <ul className="space-y-2">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <CalendarCard item={item} />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function CalendarCard({ item }: { item: CalendarItem }) {
  const Icon = iconForKind(item.kind);

  const inner = (
    <div className="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
      <div className="flex min-w-0 items-start gap-3">
        <Icon size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0">
          <p className="text-xs text-muted">{libelleType(item.kind)}</p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            {item.code && <span className="font-mono text-sm font-medium text-ivory">{item.code}</span>}
            {item.societe && <span className="truncate text-sm text-ivory/90">{item.societe}</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
          {item.datetime && (
            <p className="mt-0.5 text-xs text-faint">
              {new Date(item.datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {item.pays ? `, ${item.pays}` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {item.montant != null && (
          <p>
            <span className="tabular text-sm text-ivory">{montantDividende(item.montant)}</span>
            <span className="ml-1 text-xs text-muted">FCFA par action</span>
          </p>
        )}
        {item.secteur && <p className="mt-0.5 text-xs text-faint">{item.secteur}</p>}
        {item.importance != null && item.importance >= 3 && (
          <p className="mt-0.5 text-xs text-muted">Importance {item.importance} sur 5</p>
        )}
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {inner}
      </Link>
    );
  }
  return inner;
}
