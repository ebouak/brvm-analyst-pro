'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: '📊 Dashboard' },
  { href: '/actions', label: '📈 Actions' },
  { href: '/obligations', label: '📋 Obligations' },
  { href: '/signaux', label: '🔔 Signaux' },
  { href: '/portefeuille', label: '💼 Portefeuille' },
  { href: '/backtest', label: '🔬 Backtest' },
  { href: '/dashboard/reports', label: '📑 Rapports' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-surface/60 p-4 hidden md:block">
      <div className="font-semibold mb-6">
        BRVM<span className="text-up"> Analyst</span>
      </div>
      <nav className="space-y-1">
        {NAV.map((n) => {
          const active =
            n.href === '/'
              ? pathname === '/'
              : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`block px-3 py-2 rounded text-sm transition ${
                active
                  ? 'bg-up/10 text-up font-medium'
                  : 'text-muted hover:text-white hover:bg-bg'
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
