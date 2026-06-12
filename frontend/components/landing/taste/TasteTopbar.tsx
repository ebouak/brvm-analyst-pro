import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import type { TickItem } from './types';

/** Header flottant en pilule + ticker de séance (données réelles) + accès. */
export function TasteTopbar({ ticks }: { ticks: TickItem[] }) {
  const doubled = [...ticks, ...ticks];
  return (
    <header className="sticky top-3 z-40 flex items-center gap-4 rounded-full border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] px-4 py-3 shadow-card backdrop-blur-xl">
      <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="BRVM Analyst Pro">
        <BrandLogo size={42} />
        <div className="hidden sm:block">
          <div className="overline text-gold-2">BRVM Analyst Pro · UEMOA</div>
          <div className="font-display text-[0.95rem] font-semibold text-ivory">Grand salon de marché</div>
        </div>
      </Link>

      <div
        className="min-w-0 flex-1 overflow-hidden border-x border-white/10 px-4"
        style={{ maskImage: 'linear-gradient(90deg,transparent,black 6%,black 94%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,black 6%,black 94%,transparent)' }}
      >
        {doubled.length > 0 ? (
          <div className="flex w-max animate-ticker gap-8 whitespace-nowrap font-mono">
            {doubled.map((t, i) => (
              <span key={`${t.sym}-${i}`} className="inline-flex items-center gap-[0.45rem] text-[11px] font-bold">
                <span className="text-muted">{t.sym}</span>
                <span className="text-ivory">{t.val}</span>
                <span className={t.dir === 'up' ? 'text-up' : 'text-down'}>{t.pct}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-faint">Séance à venir</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/societes"
          className="hidden min-h-[42px] items-center px-3 text-sm text-muted transition-colors hover:text-ivory lg:inline-flex"
        >
          Sociétés
        </Link>
        <Link
          href="/simulateur"
          className="hidden min-h-[42px] items-center px-3 text-sm text-muted transition-colors hover:text-ivory lg:inline-flex"
        >
          Simulateur
        </Link>
        <Link
          href="/brief"
          className="hidden min-h-[42px] items-center px-3 text-sm text-muted transition-colors hover:text-ivory xl:inline-flex"
        >
          Brief
        </Link>
        <Link
          href="/login"
          className="hidden min-h-[42px] items-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm text-muted transition-all hover:bg-white/[0.06] sm:inline-flex"
        >
          Terminal
        </Link>
        <Link
          href="/premium/diagnostic"
          className="inline-flex min-h-[42px] items-center rounded-full px-4 text-sm font-bold text-[#03222b] shadow-gold"
          style={{ background: 'linear-gradient(180deg,#8fe6ff,#56d7fd)' }}
        >
          Diagnostic IA
        </Link>
      </div>
    </header>
  );
}
