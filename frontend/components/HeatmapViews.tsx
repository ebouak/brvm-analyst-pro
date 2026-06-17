'use client';

import { useState } from 'react';
import HeatmapTreemap from '@/components/HeatmapTreemap';
import HeatmapGrid from '@/components/HeatmapGrid';
import type { HeatmapNode } from '@/lib/heatmap';

type View = 'treemap' | 'grid';

interface Props {
  rows: HeatmapNode[];
  logos?: Record<string, string | null>;
}

/**
 * Bascule entre la cartographie proportionnelle (treemap, façon TradingView —
 * taille = capitalisation, couleur = variation) et la grille de tuiles
 * existante. Le treemap est la vue par défaut ; la grille reste disponible
 * pour ne rien retirer de l'existant.
 */
export default function HeatmapViews({ rows, logos = {} }: Props) {
  const [view, setView] = useState<View>('treemap');

  const Btn = ({ mode, label }: { mode: View; label: string }) => (
    <button
      type="button"
      onClick={() => setView(mode)}
      aria-pressed={view === mode}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Btn mode="treemap" label="Cartographie" />
          <Btn mode="grid" label="Grille" />
        </div>
        {view === 'treemap' && (
          <span className="text-[10px] text-faint hidden sm:block">
            Taille = capitalisation · couleur = variation du jour
          </span>
        )}
      </div>

      {view === 'treemap' ? (
        <HeatmapTreemap data={rows} height={560} />
      ) : (
        <HeatmapGrid rows={rows} logos={logos} />
      )}
    </div>
  );
}
