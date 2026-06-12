import type { ViewTab } from '@/components/ViewTabs';

/** Les 3 vues de l'espace Calendrier (audit 2026-06-12 : unification UX). */
export const CALENDAR_TABS: ViewTab[] = [
  { href: '/calendrier', label: "Vue d'ensemble" },
  { href: '/dividendes/calendrier', label: 'Dividendes (annuel)' },
  { href: '/premium/calendrier', label: 'Dates clés', premium: true },
];
