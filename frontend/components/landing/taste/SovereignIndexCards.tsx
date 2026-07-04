import type { IndexCard } from './types';

/** Indices BRVM traités comme objets de séance premium. */
export function SovereignIndexCards({ indices }: { indices: IndexCard[] }) {
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-gradient-to-b from-elevated/50 to-surface/30 shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-3">
        <span className="overline text-muted">Indices souverains</span>
        <span className="overline text-faint">objets de séance</span>
      </header>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {indices.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-muted">Indices indisponibles pour le moment.</div>
        )}
        {indices.map((idx) => (
          <article
            key={idx.name}
            className="relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-card border p-4"
            style={
              idx.featured
                ? { background: 'linear-gradient(135deg,rgba(86,215,253,0.16),rgba(86,215,253,0.05) 36%,rgba(255,255,255,0.03))', borderColor: 'rgba(86,215,253,0.22)', boxShadow: '0 0 0 1px rgba(86,215,253,0.14), 0 24px 80px rgba(86,215,253,0.11)' }
                : { background: 'linear-gradient(180deg, rgb(var(--color-elevated) / 0.5), rgb(var(--color-surface) / 0.3))', borderColor: 'rgb(var(--color-border))' }
            }
          >
            <span className="overline text-faint">{idx.name}</span>
            <div>
              <div className="font-display" style={{ fontSize: 'clamp(2.3rem,4vw,4rem)', lineHeight: 0.88, letterSpacing: '-0.08em' }}>
                {idx.value}
              </div>
              <div className={`mt-2 font-mono text-[12px] font-bold ${idx.dir === 'up' ? 'text-up' : 'text-down'}`}>{idx.move}</div>
              <div className="mt-3 text-sm text-muted">{idx.desc}</div>
            </div>
            <span aria-hidden className="absolute bottom-0 left-4 right-4 h-px bg-gold-line opacity-75" />
          </article>
        ))}
      </div>
    </section>
  );
}
