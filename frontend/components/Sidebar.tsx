'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS, isNavItemActive } from '@/lib/nav';
import BeginnerToggle from '@/components/BeginnerToggle';

const EASE = 'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

export default function Sidebar({
  isPremium = false,
  isAdmin = false,
}: {
  isPremium?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);

  return (
    <aside className="w-56 shrink-0 hidden md:flex flex-col h-screen sticky top-0 bg-gradient-to-b from-surface to-bg border-r border-border">
      {/* Marque — logo double-bezel */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-gold/30 bg-gradient-to-b from-gold/15 to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            <span className="font-display text-base font-semibold text-gold">B</span>
          </div>
          <div className="leading-none">
            <p className="font-display text-sm font-semibold tracking-tight text-ivory">WESTBOURSE</p>
            <p className="overline mt-1 text-[9px] text-gold/70">Pro · UEMOA</p>
          </div>
        </div>
      </div>
      <div className="mx-4 h-px bg-gold-line opacity-60" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="overline px-2 mb-2 text-[9px] text-faint">
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
                if (locked) {
                  return (
                    <Link
                      key={item.href}
                      href="/premium/upgrade"
                      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-faint hover:text-gold hover:bg-gold/[0.06] ${EASE}`}
                    >
                      {item.label}
                      <span className="ml-auto text-[9px] opacity-60 group-hover:opacity-100">🔒</span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm ${EASE} ${
                      active
                        ? 'bg-gold/[0.10] text-gold font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                        : 'text-muted hover:text-ivory hover:bg-white/[0.03] hover:translate-x-0.5'
                    }`}
                  >
                    {/* Barre or de l'élément actif */}
                    <span
                      className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-gold ${EASE} ${
                        active ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    {item.label}
                    {item.premium && (
                      <span className="ml-auto rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-gold">
                        PRO
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied */}
      <div className="px-4 py-3.5 border-t border-border space-y-3">
        <div className="flex justify-center gap-4 text-[11px]">
          <Link href="/methodologie" className="text-faint hover:text-muted transition-colors">
            Méthodologie
          </Link>
          <Link href="/parametres/compte" className="text-faint hover:text-muted transition-colors">
            Paramètres
          </Link>
        </div>
        <div className="flex justify-center">
          <BeginnerToggle />
        </div>
        <p className="overline text-[9px] text-faint text-center">Données BRVM · BDFIN</p>
      </div>
    </aside>
  );
}
