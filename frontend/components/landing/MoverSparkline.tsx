import { sparklinePath } from '@/lib/landing/sparkline';

/**
 * Mini-courbe d'une valeur dans les « Top 5 hausses / baisses ».
 *
 * Tracée à partir des vraies clôtures des dernières séances. Aucune couleur
 * n'est fixée ici : le trait et l'aplat héritent de `currentColor`, donc de
 * `text-up` / `text-down` posés par la ligne parente — la courbe reste juste
 * dans les deux thèmes. Sans historique exploitable, on ne rend rien plutôt
 * qu'une courbe décorative.
 */
export function MoverSparkline({ values, width = 56, height = 20 }: { values: number[]; width?: number; height?: number }) {
  const geo = sparklinePath(values, width, height);
  if (!geo) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path d={geo.area} fill="currentColor" opacity={0.12} />
      <path d={geo.line} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
