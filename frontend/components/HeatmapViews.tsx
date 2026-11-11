'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useRouter } from 'next/navigation';
import HeatmapTreemap from '@/components/HeatmapTreemap';
import type { ColorFilter } from '@/components/HeatmapTreemap';
import HeatmapGrid from '@/components/HeatmapGrid';
import type { HeatmapNode } from '@/lib/heatmap';

type View = 'treemap' | 'grid';

interface Props {
  rows: HeatmapNode[];
  logos?: Record<string, string | null>;
  /**
   * Légende des couleurs, posée dans la barre d'outils au-dessus de la carte.
   * Sans elle, une phrase sous la cartographie explique taille et couleur.
   */
  legende?: ReactNode;
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

/** Largeur réelle d'un conteneur (px), `null` avant la première mesure. */
function useLargeur<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setLargeur(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largeur];
}

/** Classes communes d'un segment de contrôle (vue, filtre). */
const SEGMENT = [
  'relative h-8 rounded-md px-3 text-xs font-medium transition-colors',
  // Cible tactile de 44 px sans grossir le contrôle.
  "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
  'active:bg-elevated disabled:cursor-not-allowed disabled:opacity-55',
].join(' ');
const SEGMENT_ACTIF = 'bg-accent/15 text-accent-ink';
const SEGMENT_INACTIF = 'text-muted hover:bg-elevated hover:text-ivory';
const GROUPE = 'inline-flex gap-0.5 rounded-lg border border-border bg-sunken p-0.5';

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
export default function HeatmapViews({ rows, logos = {}, legende }: Props) {
  const isMd = useIsMd();
  const [choix, setChoix] = useState<View | null>(null);
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [refCarte, largeurCarte] = useLargeur<HTMLDivElement>();

  // Vue effective : choix explicite, sinon déduite de la largeur, sinon
  // inconnue (null) → arbitrage par le CSS.
  const view: View | null = choix ?? (isMd == null ? null : isMd ? 'treemap' : 'grid');

  const hauteur = isMd === false ? 520 : 560;
  // Ratio largeur/hauteur MESURÉ (dimensionnement des logos et des libellés) ;
  // avant la mesure, l'estimation d'avant : un téléphone est plus haut que large.
  const aspect = largeurCarte ? largeurCarte / hauteur : isMd === false ? 0.65 : 2;

  const ViewBtn = ({ mode, label }: { mode: View; label: string }) => {
    // Avant le montage : état visuel porté par le CSS, comme les vues.
    const auto =
      mode === 'treemap'
        ? `${SEGMENT_INACTIF} md:bg-accent/15 md:text-accent-ink`
        : `${SEGMENT_ACTIF} md:bg-transparent md:text-muted`;
    return (
      <button
        type="button"
        onClick={() => setChoix(mode)}
        aria-pressed={view == null ? undefined : view === mode}
        className={`${SEGMENT} ${view == null ? auto : view === mode ? SEGMENT_ACTIF : SEGMENT_INACTIF}`}
      >
        {label}
      </button>
    );
  };

  const FilterBtn = ({ mode, label }: { mode: ColorFilter; label: string }) => (
    <button
      type="button"
      onClick={() => setColorFilter(mode)}
      aria-pressed={colorFilter === mode}
      className={`${SEGMENT} ${colorFilter === mode ? SEGMENT_ACTIF : SEGMENT_INACTIF}`}
    >
      {label}
    </button>
  );

  const montrerTreemap = view !== 'grid';
  const montrerGrille = view !== 'treemap';
  // Classes des conteneurs : arbitrage CSS avant le montage, explicite ensuite.
  const clsTreemap = view == null ? 'hidden md:block' : view === 'treemap' ? '' : 'hidden';
  const clsGrille = view == null ? 'md:hidden' : view === 'grid' ? '' : 'hidden';
  const clsFiltres = view == null ? 'hidden md:inline-flex' : view === 'treemap' ? 'inline-flex' : 'hidden';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className={GROUPE} role="group" aria-label="Type de vue">
          <ViewBtn mode="treemap" label="Cartographie" />
          <ViewBtn mode="grid" label="Grille" />
        </div>

        <div className={`${GROUPE} ${clsFiltres}`} role="group" aria-label="Filtrer la cartographie">
          <FilterBtn mode="all" label="Tout" />
          <FilterBtn mode="up" label="Hausses" />
          <FilterBtn mode="down" label="Baisses" />
        </div>

        {legende && <div className="w-full sm:ml-auto sm:w-auto">{legende}</div>}
      </div>

      <div className={clsTreemap}>
        {montrerTreemap && (
          <div ref={refCarte} className="space-y-3">
            {/* Hauteur fixée par la prop : aucun saut de mise en page à
                l'arrivée d'ECharts. */}
            <div className="overflow-hidden rounded-lg">
              <HeatmapTreemap
                data={rows}
                height={hauteur}
                aspect={aspect}
                logos={logos}
                colorFilter={colorFilter}
              />
            </div>
            {!legende && (
              <p className="text-xs text-faint">
                La taille suit la capitalisation, la couleur la variation du jour ; le logo de la
                société s&apos;affiche quand la tuile le permet.
              </p>
            )}
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
      <label htmlFor={id} className="whitespace-nowrap text-xs text-muted">
        Secteur
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
        className="h-10 min-w-0 flex-1 rounded-md border border-border-strong bg-sunken px-3 text-sm text-ivory hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
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
          className="h-10 rounded-md border border-border-strong bg-elevated px-3 text-xs text-ivory hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:bg-sunken"
        >
          Filtrer
        </button>
      </noscript>
    </form>
  );
}
