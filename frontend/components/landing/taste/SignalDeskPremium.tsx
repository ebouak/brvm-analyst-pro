import Link from 'next/link';
import type { SignalRow } from './types';

const STYLE: Record<SignalRow['action'], { cls: string; label: string }> = {
  BUY: { cls: 'border-up/20 bg-up/10 text-up', label: 'ACHAT' },
  HOLD: { cls: 'border-sapphire/20 bg-sapphire/10 text-sapphire', label: 'CONSERVER' },
  SELL: { cls: 'border-down/20 bg-down/10 text-down', label: 'VENTE' },
};

/** Desk des signaux récents — conviction avec score. */
export function SignalDeskPremium({ signals }: { signals: SignalRow[] }) {
  return (
    <section className="overflow-hidden rounded-panel border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.02] shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span className="overline text-muted">Desk des signaux</span>
        <span className="overline text-faint">conviction récente</span>
      </header>
      <div className="flex flex-col gap-3 p-4">
        {signals.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">Aucun signal récent à afficher.</div>
        )}
        {signals.map((sig) => {
          const s = STYLE[sig.action];
          return (
            <Link
              href={`/actions/${sig.code}`}
              key={`${sig.code}-${sig.action}`}
              className="grid items-start gap-3 rounded-card border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:bg-white/[0.06]"
              style={{ gridTemplateColumns: 'auto 1fr auto' }}
            >
              <span className={`inline-flex min-h-[30px] min-w-[64px] items-center justify-center rounded-full border px-3 font-mono text-[10px] font-bold tracking-[0.14em] ${s.cls}`}>
                {s.label}
              </span>
              <div className="min-w-0">
                <div className="font-semibold leading-snug text-ivory">{sig.code}</div>
                <div className="mt-1 text-[0.92rem] text-muted">{sig.title}</div>
              </div>
              <div className="shrink-0 text-right">
                <strong className="block font-display" style={{ fontSize: '2rem', lineHeight: 0.9, letterSpacing: '-0.06em' }}>
                  {sig.score}
                </strong>
                <span className="overline mt-1 block text-faint">Confiance</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
