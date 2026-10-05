'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';

const OUTILS = [
  { t: 'SGI', d: 'Choisir sa SGI', href: '/comparateur-sgi' },
  { t: 'Simulateur', d: 'Et si vous aviez investi ?', href: '/simulateur' },
  { t: 'Budget', d: 'Plan d’épargne', href: '/simulateur-budget' },
  { t: 'Paper trading', d: 'Capital virtuel — Premium ✦', href: '/premium/paper-trading' },
  { t: 'Backtest', d: 'Rejouer une stratégie', href: '/backtest' },
  { t: 'Dossier d’analyse', d: 'Rapport par société — Premium ✦', href: '/premium/diagnostic' },
] as const;

function OutilsDrop() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-white/[0.06] hover:text-ivory">
        Outils
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={id} role="menu" className="absolute left-0 top-[calc(100%+8px)] z-40 grid min-w-[300px] gap-1 rounded-2xl border border-border bg-surface p-2 shadow-panel">
          {OUTILS.map((o) => (
            <Link key={o.href} href={o.href} role="menuitem" onClick={() => setOpen(false)} className="grid gap-0.5 rounded-xl px-3 py-2.5 hover:bg-elevated">
              <span className="text-sm font-semibold text-ivory">{o.t}</span>
              <span className="text-xs text-muted">{o.d}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileDrawer({ marchesHref }: { marchesHref: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open]);
  const links = [
    { t: 'Marches', href: marchesHref },
    { t: 'Societes', href: '/societes' },
    { t: 'Analyses', href: '/analyses' },
    { t: 'Formations', href: '/formations' },
    { t: 'A propos', href: '/methodologie' },
    { t: 'Se connecter', href: '/login' },
  ] as const;
  return (
    <div className="md:hidden">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} aria-label={open ? 'Fermer' : 'Ouvrir'} onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-ivory">
        <span className="relative block h-3.5 w-4">
          <span className={`absolute left-0 h-[1.5px] w-full rounded bg-current transition-all duration-300 ${open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'}`} />
          <span className={`absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rounded bg-current transition-all duration-300 ${open ? 'opacity-0' : 'opacity-100'}`} />
          <span className={`absolute left-0 h-[1.5px] w-full rounded bg-current transition-all duration-300 ${open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-0'}`} />
        </span>
      </button>
      <div className={`fixed inset-0 z-30 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-bg/80 backdrop-blur-md transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <nav id={id} aria-label="Menu" className={`absolute inset-x-0 top-[57px] bottom-0 overflow-y-auto bg-bg px-5 py-6 transition-all duration-300 ${open ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
          <div className="flex justify-center mb-6"><ThemeToggle /></div>
          <div className="space-y-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-medium text-ivory hover:bg-white/[0.06]">{l.t}</Link>
            ))}
          </div>
          <p className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Outils</p>
          <div className="mt-2 space-y-1">
            {OUTILS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-[44px] items-center rounded-xl px-3 text-sm text-muted hover:text-ivory hover:bg-white/[0.04]">{l.t}</Link>
            ))}
          </div>
          <div className="mt-8"><Link href="/signup" onClick={() => setOpen(false)} className="flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-bg">Creer mon compte gratuit -{'>'}</Link></div>
        </nav>
      </div>
    </div>
  );
}

export function SiteHeader({ marchesHref = '/#marche' }: { marchesHref?: string }) {
  const pathname = usePathname();
  const active = (h: string) => pathname === h || pathname.startsWith(h + '/');
  const cls = (h: string) => `inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active(h) ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-white/[0.06] hover:text-ivory'}`;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" aria-label="WESTBOURSE accueil" className="flex shrink-0 items-center gap-2.5">
          <AnimatedLogo size={30} variant="mark" animate={false} />
          <span className="hidden font-display text-lg font-semibold tracking-tight text-ivory min-[400px]:inline">WESTBOURSE</span>
          <span className="ml-1 hidden border-l border-border pl-3 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-faint lg:block">Comprendre aujourd&apos;hui,<br />investir demain</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          <Link href={marchesHref} className={cls('/#marche')}>Marches</Link>
          <Link href="/societes" className={cls('/societes')}>Societes</Link>
          <Link href="/analyses" className={cls('/analyses')}>Analyses</Link>
          <Link href="/formations" className={cls('/formations')}>Formations</Link>
          <OutilsDrop />
          <Link href="/methodologie" className={cls('/methodologie')}>A propos</Link>
          <span className="mx-1 hidden h-5 w-px bg-border lg:block" aria-hidden />
          <ThemeToggle className="hidden lg:inline-flex" />
          <Link href="/login" className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ivory">Se connecter</Link>
          <Link href="/signup" className="ml-1 whitespace-nowrap rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-gold-2">Creer mon compte gratuit</Link>
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link href="/signup" className="whitespace-nowrap rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-bg">Creer un compte</Link>
          <MobileDrawer marchesHref={marchesHref} />
        </div>
      </div>
    </header>
  );
}
export default SiteHeader;
