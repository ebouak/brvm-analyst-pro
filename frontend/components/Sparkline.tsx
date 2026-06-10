/** Mini sparkline SVG inline — données de cours (tableau de nombres). Server Component. */
export default function Sparkline({
  data,
  width = 64,
  height = 24,
  up,
}: {
  data: number[];
  width?: number;
  height?: number;
  up: boolean;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = up ? '#3fe18b' : '#ff6b6b';
  const fillId = `sf-${up ? 'u' : 'd'}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Zone de remplissage */}
      <polygon
        points={`0,${height} ${pts.join(' ')} ${width},${height}`}
        fill={`url(#${fillId})`}
      />
      {/* Ligne */}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Point final */}
      <circle
        cx={parseFloat(pts[pts.length - 1]!.split(',')[0]!)}
        cy={parseFloat(pts[pts.length - 1]!.split(',')[1]!)}
        r="2"
        fill={stroke}
      />
    </svg>
  );
}
