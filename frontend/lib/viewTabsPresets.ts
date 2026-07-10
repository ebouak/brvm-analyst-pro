import type { ViewTab } from '@/components/ViewTabs';

/**
 * Presets d'onglets des espaces fonctionnels regroupés (refonte nav 2026-07-10 :
 * moins d'entrées de menu, les vues sœurs restent accessibles par onglets —
 * même pattern que REPORT_TABS).
 */

/** Espace Intelligence : les 3 flux « que se passe-t-il sur le marché ? ». */
export const INTEL_TABS: ViewTab[] = [
  { href: '/actualites', label: 'Actualités' },
  { href: '/veille', label: 'Veille Intelligence' },
  { href: '/weekly', label: 'Analyses hebdo' },
];

/** Espace Fondamentaux : ratios + notations des émetteurs. */
export const FONDA_TABS: ViewTab[] = [
  { href: '/fondamentaux', label: 'Fondamentaux' },
  { href: '/notations', label: 'Notations' },
];

/** Espace Valorisation : multiples + DCF. */
export const VALO_TABS: ViewTab[] = [
  { href: '/premium/valorisation', label: 'Multiples', premium: true },
  { href: '/premium/dcf', label: 'DCF', premium: true },
];
