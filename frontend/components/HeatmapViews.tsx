'use client';

import { useState } from 'react';
import HeatmapTreemap from '@/components/HeatmapTreemap';
import type { ColorFilter } from '@/components/HeatmapTreemap';
import HeatmapGrid from '@/components/HeatmapGrid';
import type { HeatmapNode } from '@/lib/heatmap';

type View = 'treemap' | 'grid';

interface Props {
  rows: HeatmapNode[];
  logos?: Record<string, string | null>;
}

/**
 * Bascule entre la cartographie proportionnelle (treemap, façon TradingView —
 * taille = capitalisation, logo + couleur = variation) et la grille de tuiles
 * existante. Le treemap est la vue par défaut ; la grille reste disponible
 * pour ne rien retirer de l'existant. Un filtre couleur (Tout / Hausses /
 * Baisses) restreint l'affichage du treemap.
 */
export default function HeatmapViews({ rows, logos = {} }: Props) {
  const [view, setView] = useState<View>('treemap');
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');

  const ViewBtn = ({ mode, label }: { mode: View; label: string }) => (
    <button
      type="button"
      onClick={() => setView(mode)}
      aria-pressed={view === mode ? 'true' : 'false'}
      className={[
        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
        view === mode
          ? 'bg-ivory text-obsidian'
          : 'bg-elevated border border-border text-muted hover:text-ivory hover:border-border-strong',
      ].join(' ')}
    >
      {label}
    </button>
  );

  const FilterBtn = ({ mode, label, dot }: { mode: ColorFilter; label: string; dot?: string }) => (
    <button
      type="button"
      onClick={() => setColorFilter(mode)}
      aria-pressed={colorFilter === mode ? 'true' : 'false'}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
        colorFilter === mode
          ? 'bg-elevated border border-border-strong text-ivory'
          : 'bg-elevated/40 border border-border text-muted hover:text-ivory hover:border-border-strong',
      ].join(' ')}
    >
      {dot && <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <ViewBtn mode="treemap" label="Cartographie" />
          <ViewBtn mode="grid" label="Grille" />
        </div>

        {view === 'treemap' && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterBtn mode="all" label="Tout" />
            <FilterBtn mode="up" label="Hausses" dot="bg-up" />
            <FilterBtn mode="down" label="Baisses" dot="bg-down" />
          </div>
        )}
      </div>

      {view === 'treemap' ? (
        <>
          <HeatmapTreemap data={rows} height={560} logos={logos} colorFilter={colorFilter} />
          <p className="text-[10px] text-faint">
            Taille = capitalisation · couleur = variation du jour · logo de la société dans chaque tuile
          </p>
        </>
      ) : (
        <HeatmapGrid rows={rows} logos={logos} />
      )}
    </div>
  );
}
