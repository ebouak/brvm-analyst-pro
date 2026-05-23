'use client';

interface Signal {
  code: string;
  date_marche: string;
  signal: 'BUY' | 'HOLD' | 'SELL';
  score_total: number;
  confiance: number | null;
  explication: string | null;
}

const SIGNAL_CLS: Record<string, string> = {
  BUY: 'text-up',
  SELL: 'text-down',
  HOLD: 'text-muted',
};

export default function SignalsTable({ signals }: { signals: Signal[] }) {
  const actionable = signals.filter((s) => s.signal !== 'HOLD');

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">Signaux générés</h2>
      {actionable.length === 0 ? (
        <p className="text-sm text-muted">Aucun signal BUY / SELL sur cette période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Signal</th>
                <th className="pb-2 pr-4 tabular">Score</th>
                <th className="pb-2">Explication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {actionable.map((s, i) => (
                <tr key={i} className="hover:bg-bg/40">
                  <td className="py-2 pr-4 tabular text-xs text-muted">{s.date_marche}</td>
                  <td className="py-2 pr-4 font-medium">{s.code}</td>
                  <td className={`py-2 pr-4 font-semibold ${SIGNAL_CLS[s.signal]}`}>
                    {s.signal}
                  </td>
                  <td className="py-2 pr-4 tabular text-xs">{s.score_total.toFixed(2)}</td>
                  <td className="py-2 text-xs text-muted max-w-xs truncate">
                    {s.explication ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
