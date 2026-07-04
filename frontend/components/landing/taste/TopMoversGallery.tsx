import type { Mover } from './types';

function MoverItem({ mover, rank }: { mover: Mover; rank: number }) {
  return (
    <article
      className="grid items-center gap-3 rounded-card border border-border bg-surface/40 p-3 transition-all hover:bg-elevated/60"
      style={{ gridTemplateColumns: 'auto 1fr auto' }}
    >
      <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px] bg-elevated/50 font-mono text-[11px] font-bold text-muted">
        {String(rank).padStart(2, '0')}
      </div>
      <div>
        <div className="font-semibold text-ivory">{mover.sym}</div>
        <div className="overline text-faint">{mover.dir === 'up' ? 'top hausse' : 'top baisse'}</div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-[12px] font-bold ${mover.dir === 'up' ? 'text-up' : 'text-down'}`}>{mover.pct}</div>
        <div className="text-[11px] text-muted">{mover.price}</div>
      </div>
    </article>
  );
}

/** Galerie des plus forts mouvements de séance (hausses / baisses). */
export function TopMoversGallery({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-gradient-to-b from-elevated/50 to-surface/30 shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-3">
        <span className="overline text-muted">Galerie des mouvements</span>
        <span className="overline text-faint">top hausses / baisses</span>
      </header>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {gainers.map((m, i) => (
            <MoverItem key={m.sym} mover={m} rank={i + 1} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {losers.map((m, i) => (
            <MoverItem key={m.sym} mover={m} rank={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
