/**
 * Sparkline SVG rendue côté serveur (aucun JS client) — pages publiques SEO.
 * Trace la série de clôtures avec remplissage dégradé.
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
      <div className="h-[120px] flex items-center justify-center text-faint text-xs">
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
  const color = positive ? '#3fe18b' : '#ff6b6b';
  const gid = positive ? 'spark-up' : 'spark-down';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Évolution du cours sur la période"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
