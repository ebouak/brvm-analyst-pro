/**
 * Sparkline SVG rendue côté serveur (aucun JS client) — pages publiques SEO.
 * Trace la série de clôtures sur un aplat léger.
 *
 * La couleur passe par `currentColor` (classes `text-up` / `text-down`) et non
 * par un hexadécimal figé : les jetons changent de valeur en mode clair, un
 * hex sombre y restait tel quel. Pas de dégradé ni d'identifiant de <defs> :
 * deux courbes sur une même page partageaient le même `id`.
 */
export default function Sparkline({
  values,
  width = 560,
  height = 120,
  positive,
}: {
  values: number[];
  width?: number;
  height?: number;
  positive: boolean;
}) {
  if (values.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center text-xs text-faint">
        Historique insuffisant
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 6;
  const stepX = (width - pad * 2) / (values.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range);

  const points = values.map((v, i) => `${(pad + i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const line = points.join(' ');
  const area = `${pad},${height - pad} ${line} ${(pad + (values.length - 1) * stepX).toFixed(1)},${height - pad}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-auto w-full ${positive ? 'text-up' : 'text-down'}`}
      role="img"
      aria-label="Évolution du cours sur la période"
    >
      <polygon points={area} fill="currentColor" fillOpacity="0.08" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
