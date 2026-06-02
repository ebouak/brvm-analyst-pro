'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  external?: boolean;
}

// URL de l'app Streamlit « Analyse fondamentale » (configurable via Vercel env).
const SCANNER_URL =
  process.env.NEXT_PUBLIC_SCANNER_URL || 'https://brvm-scanner.streamlit.app';

const NAV: NavItem[] = [
  { href: '/', label: '📊 Dashboard' },
  { href: '/heatmap', label: '🔥 Heatmap' },
  { href: '/actions', label: '📈 Actions' },
  { href: '/obligations', label: '📋 Obligations' },
  { href: '/dividendes', label: '💰 Dividendes' },
  { href: '/secteurs', label: '🏭 Secteurs' },
  { href: '/scanner', label: '🎯 Scanner' },
  { href: '/calendrier', label: '📅 Calendrier' },
  { href: '/signaux', label: '🔔 Signaux' },
  { href: '/portefeuille', label: '💼 Portefeuille' },
  { href: '/backtest', label: '🔬 Backtest' },
  { href: SCANNER_URL, label: '📑 Analyse fondamentale', external: true },
  { href: '/dashboard/reports', label: '📑 Rapports' },
  { href: '/methodologie', label: '📖 Méthodologie' },
];

const ITEM_CLASS = 'block px-3 py-2 rounded text-sm transition';
const INACTIVE_CLASS = 'text-muted hover:text-white hover:bg-bg';
const ACTIVE_CLASS = 'bg-up/10 text-up font-medium';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-surface/60 p-4 hidden md:block">
      <div className="font-semibold mb-6">
        BRVM<span className="text-up"> Analyst</span>
      </div>
      <nav className="space-y-1">
        {NAV.map((n) => {
          if (n.external) {
            return (
              <a
                key={n.href}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${ITEM_CLASS} ${INACTIVE_CLASS} flex items-center justify-between`}
              >
                <span>{n.label}</span>
                <span aria-hidden className="text-[10px] opacity-60">↗</span>
              </a>
            );
          }
          const active =
            n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`${ITEM_CLASS} ${active ? ACTIVE_CLASS : INACTIVE_CLASS}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
