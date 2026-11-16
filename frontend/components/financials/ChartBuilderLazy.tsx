'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type ChartBuilder from './ChartBuilder';

/**
 * Chargement paresseux du constructeur de graphique (Recharts, ~100 Ko) : il vit
 * dans un <details> fermé par défaut, la lib n'a rien à faire dans le JS
 * initial de la fiche action. Le skeleton réserve la hauteur (pas de CLS).
 */
const LazyChartBuilder = dynamic(() => import('./ChartBuilder'), {
  ssr: false,
  loading: () => <div style={{ height: 360 }} aria-hidden className="animate-pulse rounded-xl bg-white/[0.03]" />,
});

export default function ChartBuilderLazy(props: ComponentProps<typeof ChartBuilder>) {
  return <LazyChartBuilder {...props} />;
}
