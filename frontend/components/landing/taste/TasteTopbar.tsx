import Link from 'next/link';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';
import { BeamButton } from '@/components/ui/beam-button';
import { LiveTicker } from './LiveTicker';
import ThemeToggle from '@/components/ThemeToggle';
import type { TickItem } from './types';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';

/** Header flottant en pilule + ticker de séance (données réelles) + accès.
 *  Si `liveRows` + `dateMarche` sont fournis, le ticker se met à jour en temps
 *  réel (Supabase Realtime) ; sinon il affiche les `ticks` statiques (SSR). */
export function TasteTopbar({
  ticks,
  liveRows,
  dateMarche,
}: {
  ticks: TickItem[];
  liveRows?: RealtimeActionRow[];
  dateMarche?: string | null;
}) {
  const doubled = [...ticks, ...ticks];
  return (
    <header className="sticky top-3 z-40 flex items-center gap-4 rounded-full border border-border bg-gradient-to-b from-elevated/70 to-elevated/40 px-4 py-3 shadow-card backdrop-blur-xl">
      <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="WESTBOURSE">
        <AnimatedLogo size={42} variant="mark" animate={false} />
        <div className="hidden leading-tight sm:block">
          <div className="font-display text-[1.05rem] font-semibold tracking-tight text-ivory">WESTBOURSE</div>
          <div className="overline text-gold-2">UEMOA</div>
        </div>
      </Link>

      <div
        className="min-w-0 flex-1 overflow-hidden border-x border-border px-4"
        style={{ maskImage: 'linear-gradient(90deg,transparent,black 6%,black 94%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,black 6%,black 94%,transparent)' }}
      >
        {liveRows ? (
          <LiveTicker initialRows={liveRows} dateMarche={dateMarche ?? null} />
        ) : doubled.length > 0 ? (
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
        <BeamButton href="/societes" className="hidden lg:inline-flex">Sociétés</BeamButton>
        <BeamButton href="/comparateur-sgi" className="hidden lg:inline-flex">SGI</BeamButton>
        <BeamButton href="/simulateur" className="hidden lg:inline-flex">Simulateur</BeamButton>
        <BeamButton href="/brief" className="hidden xl:inline-flex">Brief</BeamButton>
        <BeamButton href="/login" className="hidden sm:inline-flex">Connexion</BeamButton>
        <ThemeToggle className="hidden sm:inline-flex" />
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
