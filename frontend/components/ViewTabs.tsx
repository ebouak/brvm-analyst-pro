import Link from 'next/link';

export interface ViewTab {
  href: string;
  label: string;
  premium?: boolean;
}

/**
 * Onglets de navigation entre vues d'un même espace fonctionnel
 * (ex. les 3 vues du calendrier). Composant serveur : la vue active
 * est passée explicitement via `current`.
 */
export default function ViewTabs({ tabs, current }: { tabs: ViewTab[]; current: string }) {
  return (
    <nav
      aria-label="Vues de la section"
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-1.5 w-fit"
    >
      {tabs.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-accent/10 text-accent font-medium border border-accent/30'
                : 'text-muted hover:text-white border border-transparent'
            }`}
          >
            {tab.label}
            {tab.premium && (
              <span className="rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-gold">
                PRO
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
