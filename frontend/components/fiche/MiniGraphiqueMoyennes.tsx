import { buildMovingAverageChart, describeMovingAveragePosition } from '@/lib/movingAverages';
import type { DatedClose, MovingAverageReading } from '@/lib/movingAverages';
import { fmtDateCourte, fmtNumber } from '@/lib/format';

const WIDTH = 640;
const HEIGHT = 190;
const LEFT = 58;
const RIGHT = 8;
const TOP = 12;
const BOTTOM = 155;

const SERIES = [
  { key: 'close', label: 'Cours de clôture', color: '--color-accent', dash: undefined },
  { key: 'sma20', label: 'Moyenne 20 séances · récent', color: '--color-ivory', dash: '5 3' },
  { key: 'sma50', label: 'Moyenne 50 séances · intermédiaire', color: '--color-muted', dash: '3 3' },
  { key: 'sma200', label: 'Moyenne 200 séances · long terme', color: '--color-faint', dash: '1.5 3' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

function pathFor(
  points: ReturnType<typeof buildMovingAverageChart>,
  key: SeriesKey,
  y: (value: number) => number,
): string {
  let drawing = false;
  return points.map((point, index) => {
    const value = point[key];
    if (value == null) {
      drawing = false;
      return '';
    }

    const x = LEFT + (index / Math.max(points.length - 1, 1)) * (WIDTH - LEFT - RIGHT);
    const command = `${drawing ? 'L' : 'M'}${x.toFixed(1)} ${y(value).toFixed(1)}`;
    drawing = true;
    return command;
  }).filter(Boolean).join(' ');
}

export function MiniGraphiqueMoyennes({
  points,
  reading,
  asOfDate,
}: {
  points: DatedClose[];
  reading: MovingAverageReading;
  asOfDate: string;
}) {
  const chart = buildMovingAverageChart(points, asOfDate);
  const values = chart.flatMap((point) => [point.close, point.sma20, point.sma50, point.sma200])
    .filter((value): value is number => value != null && Number.isFinite(value));
  const minimum = values.length ? Math.min(...values) : null;
  const maximum = values.length ? Math.max(...values) : null;
  const spread = minimum == null || maximum == null ? 0 : maximum - minimum;
  const padding = spread > 0 ? spread * 0.08 : (maximum ?? 1) * 0.02;
  const lower = minimum == null ? null : minimum - padding;
  const upper = maximum == null ? null : maximum + padding;
  const y = (value: number) => BOTTOM - ((value - lower!) / (upper! - lower!)) * (BOTTOM - TOP);
  const summary = describeMovingAveragePosition(reading);
  const availableKeys = new Set<SeriesKey>([
    'close',
    ...(chart.some((point) => point.sma20 != null) ? ['sma20' as const] : []),
    ...(chart.some((point) => point.sma50 != null) ? ['sma50' as const] : []),
    ...(chart.some((point) => point.sma200 != null) ? ['sma200' as const] : []),
  ]);
  const count = chart.length;
  const chartTitle = count
    ? `Cours et moyennes mobiles du ${fmtDateCourte(chart[0]!.date)} au ${fmtDateCourte(chart[count - 1]!.date)}`
    : 'Historique des moyennes mobiles indisponible';

  return (
    <figure className="mt-4 rounded-card border border-border/80 bg-bg/35 p-3.5 md:p-4" aria-label="Graphique des cours de clôture et moyennes mobiles">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ivory">Cours et moyennes mobiles</h4>
        <span className="tabular text-[11px] text-faint">
          {count === 0 ? 'Aucune clôture' : count === 1 ? '1 clôture affichée' : `${count} dernières clôtures`}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Chaque moyenne lisse les variations : 20 séances montrent le mouvement récent, 50 l&apos;intermédiaire et 200 le contexte de long terme.
      </p>

      {count === 0 || lower == null || upper == null ? (
        <p role="status" className="mt-4 rounded-lg border border-border px-3 py-4 text-xs leading-relaxed text-faint">
          Aucune clôture valide n&apos;est disponible pour tracer ce graphique. Les moyennes restent indisponibles.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="mt-3 block h-[150px] w-full overflow-visible sm:h-[175px]"
            role="img"
            aria-labelledby="moyennes-chart-title moyennes-chart-description"
          >
            <title id="moyennes-chart-title">{chartTitle}</title>
            <desc id="moyennes-chart-description">{summary} Les valeurs verticales sont en FCFA. Les courbes représentent uniquement les clôtures disponibles.</desc>
            {[...new Set([maximum, minimum])].map((value) => (
              <g key={value}>
                <line
                  x1={LEFT}
                  x2={WIDTH - RIGHT}
                  y1={y(value!)}
                  y2={y(value!)}
                  stroke="rgb(var(--color-border))"
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                  aria-hidden="true"
                />
                <text x={LEFT - 6} y={y(value!) + 3} textAnchor="end" fill="rgb(var(--color-faint))" fontSize="10">
                  {fmtNumber(value)}
                </text>
              </g>
            ))}
            {SERIES.filter((item) => availableKeys.has(item.key)).map((item) => {
              const d = pathFor(chart, item.key, y);
              return d ? (
                <path
                  key={item.key}
                  data-series={item.key}
                  d={d}
                  fill="none"
                  stroke={`rgb(var(${item.color}))`}
                  strokeWidth={item.key === 'close' ? 2.5 : 1.7}
                  strokeDasharray={item.dash}
                  vectorEffect="non-scaling-stroke"
                  aria-hidden="true"
                />
              ) : null;
            })}
          </svg>
          <div className="mt-1 flex justify-between gap-2 text-[10px] text-faint">
            <span className="tabular">{fmtDateCourte(chart[0]!.date)}</span>
            <span className="tabular">{fmtDateCourte(chart[count - 1]!.date)}</span>
            <span>FCFA</span>
          </div>
        </>
      )}

      <ul className="mt-3 grid gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-2" aria-label="Légende du graphique">
        {SERIES.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-muted">
            <span
              aria-hidden="true"
              className="mt-[7px] h-0 w-5 shrink-0 border-t-2"
              style={{ borderColor: `rgb(var(${item.color}))`, borderStyle: item.dash ? 'dashed' : 'solid' }}
            />
            <span>
              {item.label}
              {!availableKeys.has(item.key) && item.key !== 'close' && (
                <span className="text-faint"> · indisponible, historique insuffisant</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <figcaption className="mt-3 border-t border-border/70 pt-3 text-xs leading-relaxed text-ivory">
        {summary}
        <span className="mt-1 block text-[11px] text-faint">
          Lecture descriptive : elle ne prédit pas le cours et ne constitue pas une recommandation d&apos;achat ou de vente. Les clôtures ne sont pas ajustées des opérations sur titres.
        </span>
      </figcaption>
    </figure>
  );
}
