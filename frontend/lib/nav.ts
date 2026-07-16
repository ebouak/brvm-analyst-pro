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
 * Refonte 2026-07-10 : 44 entrées visibles → 29. Aucune page supprimée : les
 * vues sœurs restent accessibles par onglets (ViewTabs — INTEL_TABS, FONDA_TABS,
 * VALO_TABS, REPORT_TABS), via le hub /premium/outils, et par la command
 * palette ⌘K qui indexe TOUTES les routes (y compris hors menu).
 * Sorties du menu (toujours servies) : /conseiller/track-record (lié depuis
 * /conseiller), /veille + /weekly (onglets d'Actualités), /notations (onglet de
 * Fondamentaux), /premium/dcf (onglet de Valorisation), /rapports/builder +
 * /premium/reports (onglets de Rapports), /premium/classements|anomalies|
 * correlations|comparateur + /classement + /saisonnalite (hub Outils Pro).
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
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/actualites', label: 'Actualités & Veille' },
      { href: '/brief', label: 'Brief quotidien' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { href: '/conseiller', label: 'Conseiller' },
      { href: '/signaux', label: 'Signaux' },
      { href: '/screener', label: 'Screener' },
      { href: '/fondamentaux', label: 'Fondamentaux' },
      { href: '/backtest', label: 'Backtest' },
    ],
  },
  {
    label: 'Revenus',
    items: [
      { href: '/dividendes', label: 'Dividendes' },
      { href: '/calendrier', label: 'Calendrier' },
      { href: '/rendement-vrai', label: 'Rendement réel & vrai (après inflation)' },
      { href: '/fiscalite', label: 'Fiscalité des dividendes' },
      { href: '/saisonnalite', label: 'Saisonnalité' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/portefeuille', label: 'Portefeuille' },
      { href: '/parametres/alertes', label: 'Mes alertes' },
      { href: '/premium/paper-trading', label: 'Paper Trading', premium: true },
      { href: '/reports', label: 'Rapports' },
    ],
  },
  {
    label: 'Premium',
    items: [
      { href: '/premium/valorisation', label: 'Valorisation', premium: true },
      { href: '/premium/diagnostic', label: 'Diagnostic IA', premium: true },
      { href: '/assistant', label: 'Assistant IA', premium: true },
      { href: '/premium/outils', label: 'Outils Pro', premium: true },
    ],
  },
  {
    label: 'Découverte',
    items: [
      { href: '/societes', label: 'Sociétés (public)' },
      { href: '/comparateur-sgi', label: 'Choisir sa SGI' },
      { href: '/simulateur', label: 'Simulateur' },
      { href: '/forum', label: 'Forum' },
      { href: '/formations', label: 'Formations' },
    ],
  },
  {
    label: 'Compte',
    items: [
      { href: '/account/plan', label: 'Mon abonnement' },
      { href: '/account/billing', label: 'Facturation' },
      { href: '/account/security', label: 'Sécurité' },
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { href: '/admin', label: "Vue d'ensemble" },
      { href: '/admin/import-fondamentaux', label: 'Import IA' },
      { href: '/admin/cles-api', label: 'Clés API' },
      { href: '/admin/newsletter', label: 'Newsletter' },
      { href: '/admin/forum', label: 'Modération forum' },
    ],
  },
];

/**
 * Routes servies mais absentes du menu (refonte 2026-07-10) — indexées par la
 * command palette ⌘K pour rester trouvables en 2 frappes.
 */
export const PALETTE_EXTRA: NavItem[] = [
  { href: '/veille', label: 'Veille Intelligence' },
  { href: '/weekly', label: 'Analyses hebdo (matières premières)' },
  { href: '/conseiller/track-record', label: 'Track record du conseiller' },
  { href: '/notations', label: 'Notations financières' },
  { href: '/premium/dcf', label: 'Valorisation DCF', premium: true },
  { href: '/rapports/builder', label: 'Constructeur de rapport' },
  { href: '/premium/reports', label: 'Rapports mensuels', premium: true },
  { href: '/premium/classements', label: 'Classements', premium: true },
  { href: '/premium/anomalies', label: 'Anomalies', premium: true },
  { href: '/premium/correlations', label: 'Corrélations', premium: true },
  { href: '/premium/comparateur', label: 'Comparateur de titres', premium: true },
  { href: '/classement', label: 'Classement papier (leaderboard)' },
  { href: '/actions/compare', label: 'Comparer des actions' },
  { href: '/dashboard/reports', label: 'Rapports & événements' },
  { href: '/dashboard/reports/events', label: 'Événements de marché' },
  { href: '/dividendes/calendrier', label: 'Calendrier des dividendes' },
  { href: '/simulateur-budget', label: 'Simulateur budget' },
  { href: '/fiscalite', label: 'Fiscalité des dividendes (IRVM)' },
  { href: '/analyses', label: 'Analyses BRVM (dividende, comparatifs)' },
  { href: '/rendement-vrai', label: 'Rendement réel & vrai (dividendes + inflation)' },
  { href: '/methodologie', label: 'Méthodologie' },
  { href: '/debutant', label: 'Guide débutant' },
  { href: '/pricing', label: 'Tarifs' },
];

/** Détection d'item actif cohérente sidebar/mobile. */
export function isNavItemActive(href: string, pathname: string): boolean {
  // Routes à correspondance exacte (sinon « /admin » resterait actif sur ses
  // sous-pages /admin/cles-api, etc., et « /dashboard » sur /dashboard/*).
  if (href === '/dashboard' || href === '/admin' || href === '/conseiller') return pathname === href;
  return pathname.startsWith(href);
}
