import type { ViewTab } from '@/components/ViewTabs';

/** Les 3 vues de l'espace Rapports (audit 2026-06-12 : unification UX). */
export const REPORT_TABS: ViewTab[] = [
  { href: '/reports', label: 'Générer un rapport' },
  { href: '/dashboard/reports', label: 'Rapports & événements' },
  { href: '/premium/reports', label: 'Mensuels', premium: true },
];
