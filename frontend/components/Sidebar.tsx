import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/actions', label: 'Actions' },
  { href: '/obligations', label: 'Obligations' },
  { href: '/dashboard/reports', label: 'Rapports' },
  { href: '/signaux', label: 'Signaux' },
  { href: '/portefeuille', label: 'Portefeuille' },
  { href: '/backtest', label: 'Backtest' },
];

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 border-r border-border bg-surface/60 p-4 hidden md:block">
      <div className="font-semibold mb-6">
        BRVM<span className="text-up"> Analyst</span>
      </div>
      <nav className="space-y-1">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="block px-3 py-2 rounded text-sm text-muted hover:text-white hover:bg-bg"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
