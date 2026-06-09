import Link from 'next/link';

const STATS = [
  { label: 'Diagnostic', value: 'Sell-side IA' },
  { label: 'Classements', value: 'Propriétaires' },
  { label: 'Anomalies', value: 'Corrélations & détection' },
];

/** Bloc Cercle Premium — moment de rareté / consécration. */
export function PremiumCircle() {
  return (
    <section
      className="relative overflow-hidden rounded-panel border p-5 md:p-8"
      style={{
        borderColor: 'rgba(86,215,253,0.18)',
        background:
          'radial-gradient(circle at 74% 24%, rgba(86,215,253,0.18), transparent 24%), linear-gradient(135deg, rgba(86,215,253,0.17), rgba(86,215,253,0.05) 36%, rgba(255,255,255,0.025))',
        boxShadow: '0 0 0 1px rgba(86,215,253,0.14), 0 24px 80px rgba(86,215,253,0.11)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-3 select-none font-display"
        style={{ fontSize: 'clamp(4rem,11vw,8rem)', letterSpacing: '-0.1em', lineHeight: 0.82, color: 'rgba(255,255,255,0.05)' }}
      >
        CERCLE
      </span>
      <div className="relative z-10">
        <span className="overline text-gold-2">Cercle premium</span>
        <h3 className="mb-2 mt-3 font-display" style={{ fontSize: 'clamp(2rem,3.3vw,3.3rem)', lineHeight: 0.94, letterSpacing: '-0.06em', maxWidth: '13ch' }}>
          L’intelligence d’une maison d’investissement, à votre table.
        </h3>
        <p className="mb-4 max-w-[54ch] text-sm leading-[1.75] text-muted">
          Diagnostic IA, classements propriétaires, anomalies et corrélations — traités comme une aile privée du terminal.
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold"
            style={{ background: 'linear-gradient(180deg,#8fe6ff,#56d7fd)' }}
          >
            Rejoindre le cercle
          </Link>
          <Link
            href="/premium/diagnostic"
            className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/[0.03] px-5 text-sm text-muted transition-all hover:bg-white/[0.06]"
          >
            Voir le diagnostic IA
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-card border border-white/[0.06] p-3" style={{ background: 'rgba(0,0,0,0.14)' }}>
              <b className="overline mb-1 block text-faint">{s.label}</b>
              <span className="text-sm font-semibold text-ivory">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
