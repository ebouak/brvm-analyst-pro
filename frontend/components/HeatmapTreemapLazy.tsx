'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type HeatmapTreemap from './HeatmapTreemap';

/**
 * Chargement paresseux du treemap (ECharts, ~300-400 KB) : la lib n'est récupérée
 * qu'après l'hydratation, hors du chemin critique → réduit le TBT et le JS initial.
 * Un skeleton occupe la place pour éviter tout décalage de mise en page (CLS).
 */
const LazyTreemap = dynamic(() => import('./HeatmapTreemap'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 420 }}
      aria-hidden
      className="animate-pulse rounded-xl bg-white/[0.03]"
    />
  ),
});

export default function HeatmapTreemapLazy(props: ComponentProps<typeof HeatmapTreemap>) {
  return <LazyTreemap {...props} />;
}
