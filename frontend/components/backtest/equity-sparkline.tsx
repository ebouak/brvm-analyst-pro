/**
 * Mini-courbe d'équité en SVG inline (aucune dépendance). Thème clair.
 * Couleur verte si la progression finale est positive, rouge sinon.
 */
export function EquitySparkline({ data, width = 220, height = 48 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const y = (v: number) => height - ((v - min) / range) * (height - 4) - 2;

  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${points.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  const up = data[data.length - 1]! >= data[0]!;
  const stroke = up ? '#15803d' : '#dc2626';
  const fill = up ? 'rgba(21,128,61,0.08)' : 'rgba(220,38,38,0.08)';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution du capital sur la période" className="overflow-visible">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
