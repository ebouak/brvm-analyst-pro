import Link from 'next/link';
import type { MarketEvent } from '@/lib/types';

const SENTIMENT: Record<string, string> = {
  positive: 'border-up/50 bg-up/5',
  negative: 'border-down/50 bg-down/5',
  neutral: 'border-border bg-surface',
};

export default function EventTimeline({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-muted">Aucun événement sur la période.</p>;
  }
  return (
    <ol className="relative border-l border-border ml-2 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="ml-4">
          <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-up" />
          <div className={`border rounded-lg p-3 ${SENTIMENT[e.sentiment ?? 'neutral']}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted tabular">{e.event_date}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted">{e.event_type}</span>
            </div>
            <Link href={`/dashboard/reports/events/${e.id}`} className="text-sm font-medium hover:text-up block mt-1">
              {e.title}
            </Link>
            {e.summary && <p className="text-xs text-muted mt-1 line-clamp-2">{e.summary}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
