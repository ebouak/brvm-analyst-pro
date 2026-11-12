import type { ViewTab } from '@/components/ViewTabs';

/**
 * Les quatre produits de l'espace Rapports, chacun nommé par la question du lecteur
 * (refonte 2026-11-12, lot 2) : Dossier valeur, Revue de résultats, Événements, Relevé mensuel.
 */
export const REPORT_TABS: ViewTab[] = [
  { href: '/rapports/dossiers', label: 'Dossiers valeur' },
  { href: '/rapports/revues', label: 'Revues de résultats' },
  { href: '/dashboard/reports/events', label: 'Événements' },
  { href: '/premium/reports', label: 'Mon relevé', premium: true },
];
