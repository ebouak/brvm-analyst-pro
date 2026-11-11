'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, GraduationCap, LayoutDashboard, LineChart, Search } from 'lucide-react';
import { OPEN_PALETTE_EVENT } from '@/components/CommandPalette';
import { rubriqueDe } from '@/lib/nav';
import type { Rubrique } from '@/lib/navRegistre';

/**
 * Barre de navigation mobile fixe (< md), alignée sur les rubriques du menu
 * (spec navigation 2026-11-11 §6) : Aujourd'hui · Marché · Recherche ·
 * Portefeuille · Apprendre. Une case s'allume quand la page courante
 * appartient à sa rubrique dans le registre (lib/navRegistre.ts), sous-pages
 * et pages dynamiques comprises. « Trouver une idée » et « Mes revenus »
 * restent dans le tiroir complet (MobileNav) : aucune case ne s'y allume.
 */
type Onglet = { href: string; label: string; rubrique: Rubrique; Icone: typeof LineChart };

const AVANT: Onglet[] = [
  { href: '/dashboard', label: "Aujourd'hui", rubrique: 'aujourdhui', Icone: LayoutDashboard },
  { href: '/actions', label: 'Marché', rubrique: 'marche', Icone: LineChart },
];
const APRES: Onglet[] = [
  { href: '/portefeuille', label: 'Portefeuille', rubrique: 'portefeuille', Icone: Briefcase },
  { href: '/formations', label: 'Apprendre', rubrique: 'apprendre', Icone: GraduationCap },
];

const CASE = 'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors';

function Case({ o, rubrique }: { o: Onglet; rubrique: Rubrique | null }) {
  const actif = o.rubrique === rubrique;
  return (
    <Link
      href={o.href}
      aria-current={actif ? 'page' : undefined}
      className={`${CASE} ${actif ? 'text-accent' : 'text-muted hover:text-ivory'}`}
    >
      <o.Icone size={20} strokeWidth={1.8} aria-hidden />
      {o.label}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const rubrique = rubriqueDe(pathname);

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {AVANT.map((o) => <Case key={o.href} o={o} rubrique={rubrique} />)}
      <button
        type="button"
        aria-label="Rechercher une valeur ou une page"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className={`${CASE} text-muted hover:text-ivory active:scale-95`}
      >
        <Search size={20} strokeWidth={1.8} aria-hidden />
        Recherche
      </button>
      {APRES.map((o) => <Case key={o.href} o={o} rubrique={rubrique} />)}
    </nav>
  );
}
