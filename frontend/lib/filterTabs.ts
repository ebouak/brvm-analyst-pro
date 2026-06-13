import type { ViewTab } from '@/components/ViewTabs';

/** Les 2 vues de l'espace Filtrage (audit 2026-06-12 : unification UX). */
export const FILTER_TABS: ViewTab[] = [
  { href: '/screener', label: 'Screener (critères simples)' },
  { href: '/scanner', label: 'Scanner technique (RSI · MACD · MM)' },
];
