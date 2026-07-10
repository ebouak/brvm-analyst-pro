'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OPEN_PALETTE_EVENT } from '@/components/CommandPalette';

/**
 * Barre de navigation mobile fixe (standard fintech) : les 4 destinations
 * majeures + Recherche (ouvre la command palette). Visible < md uniquement ;
 * complète le tiroir MobileNav (qui reste la nav exhaustive).
 */
const TABS: { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode }[] = [
  {
    href: '/dashboard',
    label: 'Marché',
    match: (p) => p === '/dashboard' || p.startsWith('/actions') || p.startsWith('/secteurs') || p.startsWith('/heatmap') || p.startsWith('/obligations'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19V5m0 14h16M8 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/conseiller',
    label: 'Conseiller',
    match: (p) => p.startsWith('/conseiller') || p.startsWith('/signaux'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/portefeuille',
    label: 'Portefeuille',
    match: (p) => p.startsWith('/portefeuille') || p.startsWith('/premium/paper-trading'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/actualites',
    label: 'Actus',
    match: (p) => p.startsWith('/actualites') || p.startsWith('/veille') || p.startsWith('/weekly') || p.startsWith('/brief'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? 'text-accent' : 'text-muted hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="Rechercher un titre ou une page"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted transition-colors hover:text-white active:scale-95"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Recherche
      </button>
    </nav>
  );
}
