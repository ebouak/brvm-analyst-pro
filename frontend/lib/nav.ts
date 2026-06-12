export interface NavItem {
  href: string;
  label: string;
  premium?: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Visible uniquement pour le super-admin. */
  adminOnly?: boolean;
}

/**
 * Architecture de navigation du produit — source unique (sidebar desktop + nav mobile).
 * Cible de l'audit 2026-06-12 : 21 entrées, zéro doublon fonctionnel.
 * Les anciennes URL (/scanner, /dividendes/calendrier, /premium/calendrier,
 * /dashboard/reports, /premium/backtesting) restent servies jusqu'à leur fusion,
 * mais ne sont plus proposées dans le menu.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Marché',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/actions', label: 'Actions' },
      { href: '/obligations', label: 'Obligations' },
      { href: '/secteurs', label: 'Secteurs' },
      { href: '/heatmap', label: 'Heatmap' },
      { href: '/actualites', label: 'Actualités' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { href: '/signaux', label: 'Signaux' },
      { href: '/screener', label: 'Screener' },
      { href: '/fondamentaux', label: 'Fondamentaux' },
      { href: '/notations', label: 'Notations' },
      { href: '/backtest', label: 'Backtest' },
    ],
  },
  {
    label: 'Revenus',
    items: [
      { href: '/dividendes', label: 'Dividendes' },
      { href: '/calendrier', label: 'Calendrier' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/portefeuille', label: 'Portefeuille' },
      { href: '/premium/paper-trading', label: 'Paper Trading', premium: true },
      { href: '/reports', label: 'Rapports' },
      { href: '/premium/reports', label: 'Rapports mensuels', premium: true },
    ],
  },
  {
    label: 'Premium',
    items: [
      { href: '/premium/diagnostic', label: 'Diagnostic IA', premium: true },
      { href: '/assistant', label: 'Assistant IA', premium: true },
      { href: '/premium/classements', label: 'Classements', premium: true },
      { href: '/premium/anomalies', label: 'Anomalies', premium: true },
      { href: '/premium/correlations', label: 'Corrélations', premium: true },
      { href: '/premium/outils', label: 'Outils Pro', premium: true },
    ],
  },
  {
    label: 'Découverte',
    items: [
      { href: '/societes', label: 'Sociétés (public)' },
      { href: '/simulateur', label: 'Simulateur' },
      { href: '/brief', label: 'Brief quotidien' },
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { href: '/admin/import-fondamentaux', label: 'Import IA' },
      { href: '/admin/cles-api', label: 'Clés API' },
    ],
  },
];

/** Détection d'item actif cohérente sidebar/mobile. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}
