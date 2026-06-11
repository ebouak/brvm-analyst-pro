export interface NavItem {
  href: string;
  label: string;
  premium?: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Architecture de navigation du produit — source unique (sidebar desktop + nav mobile). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Marché',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/actions', label: 'Actions' },
      { href: '/obligations', label: 'Obligations' },
      { href: '/dividendes', label: 'Dividendes' },
      { href: '/dividendes/calendrier', label: 'Calendrier dividendes' },
      { href: '/heatmap', label: 'Heatmap' },
      { href: '/secteurs', label: 'Secteurs' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { href: '/signaux', label: 'Signaux' },
      { href: '/scanner', label: 'Scanner' },
      { href: '/screener', label: 'Screener' },
      { href: '/fondamentaux', label: 'Fondamentaux' },
      { href: '/notations', label: 'Notations' },
      { href: '/backtest', label: 'Backtest' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/portefeuille', label: 'Portefeuille' },
      { href: '/calendrier', label: 'Calendrier' },
      { href: '/dashboard/reports', label: 'Rapports' },
      { href: '/premium/reports', label: 'Rapports Mensuels', premium: true },
    ],
  },
  {
    label: 'Premium',
    items: [
      { href: '/assistant', label: 'Assistant IA', premium: true },
      { href: '/premium/diagnostic', label: 'Diagnostic IA', premium: true },
      { href: '/premium/paper-trading', label: 'Paper Trading', premium: true },
      { href: '/premium/classements', label: 'Classements', premium: true },
      { href: '/premium/calendrier', label: 'Dates clés', premium: true },
      { href: '/premium/anomalies', label: 'Anomalies', premium: true },
      { href: '/premium/backtesting', label: 'Backtesting', premium: true },
      { href: '/premium/correlations', label: 'Corrélations', premium: true },
      { href: '/premium/outils', label: 'Outils Pro', premium: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/import-fondamentaux', label: 'Import IA' },
      { href: '/admin/cles-api', label: 'Clés API' },
      { href: '/methodologie', label: 'Méthodologie' },
    ],
  },
];

/** Détection d'item actif cohérente sidebar/mobile. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}
