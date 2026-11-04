'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Calculator, Info, LayoutGrid, Scale, Target, type LucideIcon } from 'lucide-react';

export interface OngletComparateur {
  href: string;
  libelle: string;
  court: string;
  icone: LucideIcon;
}

export const ONGLETS: OngletComparateur[] = [
  { href: '/comparateur-sgi', libelle: "Vue d'ensemble", court: 'Accueil', icone: LayoutGrid },
  { href: '/comparateur-sgi/trouver', libelle: 'Trouver ma SGI', court: 'Trouver', icone: Target },
  { href: '/comparateur-sgi/simuler', libelle: 'Simuler mes frais', court: 'Simuler', icone: Calculator },
  { href: '/comparateur-sgi/comparer', libelle: 'Comparer les SGI', court: 'Comparer', icone: Scale },
  { href: '/comparateur-sgi/annuaire', libelle: 'Annuaire', court: 'Annuaire', icone: BookOpen },
  { href: '/comparateur-sgi/methodologie', libelle: 'Méthodologie', court: 'Méthode', icone: Info },
];

function estActif(pathname: string, href: string): boolean {
  return href === '/comparateur-sgi' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation entre modules, posée à cheval sur le bandeau (tablette et plus). */
export function NavigationComparateur({ nbSgi }: { nbSgi: number }) {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Modules du comparateur" className="relative z-10 mx-auto -mt-7 hidden max-w-[1280px] px-4 md:block md:px-6">
      <ul className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_40px_-24px_rgb(var(--color-nuit)/0.45)] [scrollbar-width:none]">
        {ONGLETS.map((o) => {
          const actif = estActif(pathname, o.href);
          const Icone = o.icone;
          return (
            <li key={o.href} className="flex-none lg:flex-1">
              <Link
                href={o.href}
                aria-current={actif ? 'page' : undefined}
                className={`flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors ${
                  actif ? 'bg-nuit text-sur-nuit shadow-sm' : 'text-muted hover:bg-elevated hover:text-ivory'
                }`}
              >
                <Icone size={17} aria-hidden className={actif ? 'text-accent-nuit' : 'text-accent'} />
                {o.libelle}
                {o.href.endsWith('/annuaire') && <span className="tabular text-xs opacity-70">({nbSgi})</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barre d'onglets basse sur mobile : le pouce atteint chaque module. */
export function OngletsMobile() {
  const pathname = usePathname() ?? '';
  const visibles = ONGLETS.filter((o) => o.href !== '/comparateur-sgi/methodologie');
  return (
    <nav
      aria-label="Modules du comparateur"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {visibles.map((o) => {
          const actif = estActif(pathname, o.href);
          const Icone = o.icone;
          return (
            <li key={o.href}>
              <Link
                href={o.href}
                aria-current={actif ? 'page' : undefined}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95 ${
                  actif ? 'text-accent' : 'text-muted'
                }`}
              >
                <span className={`grid h-7 w-10 place-items-center rounded-full transition-colors ${actif ? 'bg-accent/15' : ''}`}>
                  <Icone size={19} aria-hidden />
                </span>
                {o.court}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
