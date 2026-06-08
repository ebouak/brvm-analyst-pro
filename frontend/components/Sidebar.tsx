'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem { href: string; label: string; premium?: boolean; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Marché',
    items: [
      { href: '/',            label: 'Dashboard' },
      { href: '/actions',     label: 'Actions' },
      { href: '/obligations', label: 'Obligations' },
      { href: '/dividendes',  label: 'Dividendes' },
      { href: '/heatmap',     label: 'Heatmap' },
      { href: '/secteurs',    label: 'Secteurs' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { href: '/signaux',      label: 'Signaux' },
      { href: '/scanner',      label: 'Scanner' },
      { href: '/fondamentaux', label: 'Fondamentaux' },
      { href: '/notations',    label: 'Notations' },
      { href: '/backtest',     label: 'Backtest' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/portefeuille',      label: 'Portefeuille' },
      { href: '/calendrier',        label: 'Calendrier' },
      { href: '/dashboard/reports', label: 'Rapports' },
    ],
  },
  {
    label: 'Premium',
    items: [
      { href: '/premium/classements', label: 'Classements',  premium: true },
      { href: '/premium/calendrier',  label: 'Dates clés',   premium: true },
      { href: '/premium/anomalies',    label: 'Anomalies',    premium: true },
      { href: '/premium/backtesting', label: 'Backtesting',  premium: true },
      { href: '/premium/correlations', label: 'Corrélations', premium: true },
      { href: '/premium/outils',      label: 'Outils Pro',   premium: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/assistant',                 label: 'Assistant IA' },
      { href: '/admin/import-fondamentaux', label: 'Import IA' },
      { href: '/admin/cles-api',            label: 'Clés API' },
      { href: '/methodologie',              label: 'Méthodologie' },
    ],
  },
];

export default function Sidebar({ isPremium = false }: { isPremium?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 hidden md:flex flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold tracking-tight">B</span>
          </div>
          <div className="leading-none">
            <span className="text-sm font-semibold text-white">BRVM</span>
            <span className="text-sm font-semibold text-accent"> Analyst</span>
          </div>
        </div>
        <p className="text-[10px] text-faint mt-1.5 tracking-wider uppercase">Pro · UEMOA</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-faint uppercase tracking-widest px-2 mb-1.5">
              {group.label === 'Premium'
                ? <span className="flex items-center gap-1">Premium <span className="text-warn">★</span></span>
                : group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const locked = item.premium && !isPremium;
                if (locked) {
                  return (
                    <Link
                      key={item.href}
                      href="/premium/upgrade"
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded text-sm text-faint hover:text-warn hover:bg-warn/5 transition-all"
                    >
                      <span className="w-1 h-1 rounded-full shrink-0 opacity-0" />
                      {item.label}
                      <span className="ml-auto text-[10px]">🔒</span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-all ${
                      active ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {active
                      ? <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                      : <span className="w-1 h-1 rounded-full shrink-0 opacity-0" />}
                    {item.label}
                    {item.premium && <span className="ml-auto text-[9px] text-warn font-semibold">PRO</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-faint">Données BRVM · BDFIN</p>
      </div>
    </aside>
  );
}
