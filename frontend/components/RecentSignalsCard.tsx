import Link from 'next/link';
import SignalBadge from './SignalBadge';
import type { SignalDaily } from '@/lib/types';

interface SignalRow extends SignalDaily {
  designation?: string | null;
  cours_jour?: number | null;
}

export default function RecentSignalsCard({ signals }: { signals: SignalRow[] }) {
  const actionnable = signals.filter((s) => s.signal !== 'HOLD').slice(0, 4);

  if (actionnable.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">🔔 Signaux récents</h3>
        <p className="text-xs text-muted py-4 text-center">Aucun signal BUY/SELL aujourd'hui.</p>
        <Link href="/signaux" className="text-xs text-up hover:underline">Voir tous les signaux →</Link>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">🔔 Signaux récents</h3>
      <div className="space-y-2">
        {actionnable.map((s) => (
          <div key={s.code} className="border border-border/60 rounded-lg p-3 hover:border-up/20 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <SignalBadge signal={s.signal} confiance={s.confiance} />
              <span className="font-medium text-sm">{s.code}</span>
              {s.designation && (
                <span className="text-xs text-muted truncate max-w-[120px]">{s.designation}</span>
              )}
              <span className="ml-auto text-xs text-muted tabular">
                Conf: {s.confiance != null ? Math.round(s.confiance * 100) + '%' : '—'}
              </span>
            </div>
            <p className="text-xs text-muted line-clamp-2 mb-2">
              {s.explication ?? 'Signal calculé à partir des indicateurs techniques.'}
            </p>
            <div className="flex gap-3">
              <Link href={`/signaux`} className="text-xs text-muted hover:text-up">❓ Pourquoi?</Link>
              <Link href={`/actions/${s.code}`} className="text-xs text-up hover:underline">Voir fiche →</Link>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-border/50">
        <Link href="/signaux" className="text-xs text-up hover:underline">Voir tous les signaux →</Link>
      </div>
    </div>
  );
}
