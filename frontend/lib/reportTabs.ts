import type { ViewTab } from '@/components/ViewTabs';

/** Les 4 vues de l'espace Rapports (audits 2026-06-12 et 2026-07-10 : unification UX). */
export const REPORT_TABS: ViewTab[] = [
  { href: '/reports', label: 'Générer un rapport' },
  { href: '/dashboard/reports', label: 'Rapports & événements' },
  { href: '/rapports/builder', label: 'Constructeur' },
  { href: '/premium/reports', label: 'Mensuels', premium: true },
];
