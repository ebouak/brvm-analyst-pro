'use client';

interface Event {
  id: string;
  event_date: string;
  title: string;
  event_type: string;
  instrument_code: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
}

const SENTIMENT_CLS: Record<string, string> = {
  positive: 'text-up',
  negative: 'text-down',
  neutral: 'text-muted',
};

export default function EventsTable({ events }: { events: Event[] }) {
  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">Événements de la période</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Aucun événement sur cette période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Titre</th>
                <th className="pb-2">Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-bg/40">
                  <td className="py-2 pr-4 tabular text-xs text-muted">{e.event_date}</td>
                  <td className="py-2 pr-4 text-xs">{e.event_type}</td>
                  <td className={`py-2 pr-4 ${SENTIMENT_CLS[e.sentiment ?? 'neutral'] ?? 'text-muted'}`}>
                    {e.title}
                  </td>
                  <td className="py-2 text-xs text-muted">{e.instrument_code ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
