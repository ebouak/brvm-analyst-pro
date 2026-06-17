'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS, isNavItemActive } from '@/lib/nav';
import BeginnerToggle from '@/components/BeginnerToggle';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';

const EASE = 'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

/**
 * Navigation mobile (md:hidden) : barre supérieure + tiroir plein écran.
 * Réutilise NAV_GROUPS (même architecture que la sidebar desktop).
 */
export default function MobileNav({
  isPremium = false,
  isAdmin = false,
}: {
  isPremium?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);

  // Ferme le tiroir à chaque navigation + bloque le scroll quand ouvert.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Barre supérieure */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md">
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Accueil">
          <AnimatedLogo size={34} variant="mark" animate={false} />
          <span className="font-display text-sm font-semibold tracking-tight text-ivory">WESTBOURSE</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-border-strong text-ivory active:scale-95"
        >
          <span className="relative block h-3.5 w-4">
            <span
              className={`absolute left-0 h-[1.5px] w-full rounded bg-current ${EASE} ${open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'}`}
            />
            <span
              className={`absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rounded bg-current ${EASE} ${open ? 'opacity-0' : 'opacity-100'}`}
            />
            <span
              className={`absolute left-0 h-[1.5px] w-full rounded bg-current ${EASE} ${open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-0'}`}
            />
          </span>
        </button>
      </header>

      {/* Tiroir plein écran */}
      <div
        className={`fixed inset-0 z-30 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-obsidian/80 backdrop-blur-md ${EASE} ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
        <nav
          className={`absolute inset-x-0 top-[57px] bottom-0 overflow-y-auto bg-bg px-5 py-6 ${EASE} ${
            open ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
        >
          <div className="flex justify-center mb-6">
            <BeginnerToggle />
          </div>
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="overline mb-2 px-1 text-[9px] text-faint">
                  {group.label === 'Premium' ? (
                    <span className="flex items-center gap-1.5 text-gold/70">Premium <span className="text-gold">✦</span></span>
                  ) : (
                    group.label
                  )}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isNavItemActive(item.href, pathname);
                    const locked = item.premium && !isPremium;
                    const href = locked ? '/premium/upgrade' : item.href;
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] ${EASE} ${
                          active
                            ? 'bg-gold/[0.10] text-gold font-medium'
                            : 'text-muted active:bg-white/[0.04]'
                        }`}
                      >
                        {item.label}
                        {locked ? (
                          <span className="ml-auto text-xs opacity-60">🔒</span>
                        ) : item.premium ? (
                          <span className="ml-auto rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[8px] font-semibold text-gold">
                            PRO
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
