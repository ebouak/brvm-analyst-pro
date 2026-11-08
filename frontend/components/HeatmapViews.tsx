'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import HeatmapTreemap from '@/components/HeatmapTreemap';
import type { ColorFilter } from '@/components/HeatmapTreemap';
import HeatmapGrid from '@/components/HeatmapGrid';
import type { HeatmapNode } from '@/lib/heatmap';

type View = 'treemap' | 'grid';

interface Props {
  rows: HeatmapNode[];
  logos?: Record<string, string | null>;
}

/** Point de rupture `md` de Tailwind (768 px). */
const MD_QUERY = '(min-width: 768px)';

/**
 * Largeur ≥ md, connue seulement après le montage. `null` tant qu'on ne sait
 * pas : le rendu serveur et le premier rendu client sont donc identiques.
 */
function useIsMd(): boolean | null {
  const [isMd, setIsMd] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    const maj = () => setIsMd(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  return isMd;
}

/**
 * Bascule entre la cartographie proportionnelle (treemap — taille =
 * capitalisation, couleur = variation) et la grille de tuiles.
 *
 * Vue par défaut : cartographie à partir de md, GRILLE en dessous (sur un
 * téléphone, les tuiles du treemap sont trop petites pour porter code et
 * variation). Le sélecteur reste disponible partout.
 *
 * Anti-saut d'hydratation : tant que l'utilisateur n'a rien choisi ET que la
 * largeur n'est pas connue (rendu serveur + premier rendu client), les DEUX
 * vues sont rendues et c'est le CSS (`hidden md:block` / `md:hidden`) qui
 * montre la bonne. Après le montage, la vue « automatique » est résolue par
 * matchMedia vers celle que le CSS montrait déjà : rien ne bouge à l'écran, et
 * la vue masquée est démontée (ECharts n'est jamais chargé sur mobile tant
 * qu'on ne demande pas la cartographie). Les deux conteneurs gardent leur place
 * dans l'arbre : la vue visible n'est jamais remontée.
 */
export default function HeatmapViews({ rows, logos = {} }: Props) {
  const isMd = useIsMd();
  const [choix, setChoix] = useState<View | null>(null);
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');

  // Vue effective : choix explicite, sinon déduite de la largeur, sinon
  // inconnue (null) → arbitrage par le CSS.
  const view: View | null = choix ?? (isMd == null ? null : isMd ? 'treemap' : 'grid');

  const ViewBtn = ({ mode, label }: { mode: View; label: string }) => {
    const actif = 'bg-ivory text-obsidian';
    const inactif =
      'bg-elevated border border-border text-muted hover:text-ivory hover:border-border-strong';
    // Avant le montage : état visuel porté par le CSS, comme les vues.
    const auto =
      mode === 'treemap'
        ? `${inactif} md:bg-ivory md:text-obsidian md:border-transparent`
        : `${actif} md:bg-elevated md:border md:border-border md:text-muted`;
    return (
      <button
        type="button"
        onClick={() => setChoix(mode)}
        aria-pressed={view == null ? undefined : view === mode}
        className={[
          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
          view == null ? auto : view === mode ? actif : inactif,
        ].join(' ')}
      >
        {label}
      </button>
    );
  };

  const FilterBtn = ({ mode, label, dot }: { mode: ColorFilter; label: string; dot?: string }) => (
    <button
      type="button"
      onClick={() => setColorFilter(mode)}
      aria-pressed={colorFilter === mode}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
        colorFilter === mode
          ? 'bg-elevated border border-border-strong text-ivory'
          : 'bg-elevated/40 border border-border text-muted hover:text-ivory hover:border-border-strong',
      ].join(' ')}
    >
      {dot && <span aria-hidden className={`inline-block w-2 h-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );

  const montrerTreemap = view !== 'grid';
  const montrerGrille = view !== 'treemap';
  // Classes des conteneurs : arbitrage CSS avant le montage, explicite ensuite.
  const clsTreemap = view == null ? 'hidden md:block' : view === 'treemap' ? '' : 'hidden';
  const clsGrille = view == null ? 'md:hidden' : view === 'grid' ? '' : 'hidden';
  const clsFiltres = view == null ? 'hidden md:flex' : view === 'treemap' ? 'flex' : 'hidden';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Type de vue">
          <ViewBtn mode="treemap" label="Cartographie" />
          <ViewBtn mode="grid" label="Grille" />
        </div>

        <div
          className={`${clsFiltres} flex-wrap items-center gap-2`}
          role="group"
          aria-label="Filtrer la cartographie"
        >
          <FilterBtn mode="all" label="Tout" />
          <FilterBtn mode="up" label="Hausses" dot="bg-up" />
          <FilterBtn mode="down" label="Baisses" dot="bg-down" />
        </div>
      </div>

      <div className={clsTreemap}>
        {montrerTreemap && (
          <div className="space-y-4">
            <HeatmapTreemap
              data={rows}
              height={isMd === false ? 520 : 560}
              // Ratio largeur/hauteur estimé : un téléphone est plus haut que large.
              aspect={isMd === false ? 0.65 : 2}
              logos={logos}
              colorFilter={colorFilter}
            />
            <p className="text-[11px] text-faint">
              Taille = capitalisation · couleur = variation du jour · logo de la société quand la tuile le permet
            </p>
          </div>
        )}
      </div>

      <div className={clsGrille}>{montrerGrille && <HeatmapGrid rows={rows} logos={logos} />}</div>
    </div>
  );
}

/**
 * Sélecteur de secteur compact (mobile) : remplace les puces sous md. Change
 * l'URL (`?secteur=`), comme les puces — la page serveur filtre. Sans
 * JavaScript, le formulaire GET reste utilisable via le bouton « Filtrer ».
 */
export function SecteurSelect({
  secteurs,
  courant,
  className = '',
}: {
  secteurs: string[];
  courant: string | null;
  className?: string;
}) {
  const router = useRouter();
  const id = useId();
  return (
    <form method="get" action="/heatmap" className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className="text-xs text-muted whitespace-nowrap">
        Secteur :
      </label>
      <select
        id={id}
        name="secteur"
        // Non contrôlé (+ clé) : la valeur choisie reste affichée pendant la
        // navigation, puis se réaligne sur l'URL quand la page revient.
        key={courant ?? ''}
        defaultValue={courant ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/heatmap?secteur=${encodeURIComponent(v)}` : '/heatmap');
        }}
        className="min-w-0 flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <option value="">Tous</option>
        {secteurs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-ivory"
        >
          Filtrer
        </button>
      </noscript>
    </form>
  );
}
