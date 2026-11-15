'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, GraduationCap, Grid3x3, LayoutDashboard, LineChart, Lightbulb, Wallet } from 'lucide-react';
import { rubriqueDe } from '@/lib/nav';
import type { Rubrique } from '@/lib/navRegistre';
import { destinationsPouce } from '@/lib/barreDeCote';
import { OUVRIR_GRILLE_EVENT } from '@/components/layout/barre/BarreDeCote';

/**
 * Barre du bas (mobile et tablette, < 1024 px), pour l'accès au pouce : quatre
 * destinations TIRÉES DU REGISTRE (`destinationsPouce` : la première entrée de
 * menu de « Aujourd'hui », « Le marché », « Mon portefeuille » et
 * « Apprendre »), plus la grille, qui ouvre le plein écran de la barre de cote
 * (les six rubriques). La recherche vit dans la barre du haut. Une case
 * s'allume quand la page courante appartient à sa rubrique dans le registre.
 */
const ICONES: Record<Rubrique, typeof LineChart> = {
  aujourdhui: LayoutDashboard,
  marche: LineChart,
  idee: Lightbulb,
  revenus: Wallet,
  portefeuille: Briefcase,
  apprendre: GraduationCap,
};

const DESTINATIONS = destinationsPouce();

const CASE = 'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink';

export default function BottomNav() {
  const pathname = usePathname();
  const rubrique = rubriqueDe(pathname);

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden"
    >
      {DESTINATIONS.map((d) => {
        const Icone = ICONES[d.rubrique];
        const actif = d.rubrique === rubrique;
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={actif ? 'page' : undefined}
            className={`${CASE} ${actif ? 'text-accent-ink' : 'text-muted hover:text-ivory'}`}
          >
            <Icone size={20} strokeWidth={1.8} aria-hidden />
            {d.label}
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="Toutes les rubriques"
        aria-haspopup="dialog"
        onClick={() => window.dispatchEvent(new Event(OUVRIR_GRILLE_EVENT))}
        className={`${CASE} text-muted hover:text-ivory`}
      >
        <Grid3x3 size={20} strokeWidth={1.8} aria-hidden />
        Rubriques
      </button>
    </nav>
  );
}
