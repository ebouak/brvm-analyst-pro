import type { TechnicalSummaryResult } from '@/lib/technicalSummary';
import { technicalVerdict } from '@/lib/technicalSummary';

/**
 * Jauge « speedomètre » d'analyse technique (type TradingView), alimentée par
 * le décompte réel des 7 indicateurs (MA20, MACD, DMI, Bollinger, RSI,
 * Stochastique, CCI). Aucune donnée inventée : l'aiguille reflète la balance
 * haussiers/baissiers. Horizon = séance quotidienne (la BRVM ne fournit pas
 * d'OHLCV intraday, on n'invente donc pas de pas de temps 1 min / 5 min).
 */

const CX = 100;
const CY = 100;
const R = 78; // rayon médian de l'arc
const STROKE = 16;

// Zones de gauche (vente forte) à droite (achat fort), 36° chacune.
const ZONES: { tone: string; color: string; from: number; to: number }[] = [
  { tone: 'strong-sell', color: '#ff6b6b', from: 180, to: 144 },
  { tone: 'sell', color: '#ff9d7a', from: 144, to: 108 },
  { tone: 'neutral', color: '#4a5268', from: 108, to: 72 },
  { tone: 'buy', color: '#7fe6a8', from: 72, to: 36 },
  { tone: 'strong-buy', color: '#3fe18b', from: 36, to: 0 },
];

function polar(deg: number, radius: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)];
}

/** Chemin d'arc (du plus grand angle au plus petit → sens horaire à l'écran). */
function arcPath(from: number, to: number, radius: number): string {
  const [x1, y1] = polar(from, radius);
  const [x2, y2] = polar(to, radius);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function toneTextClass(tone: string): string {
  switch (tone) {
    case 'strong-sell':
    case 'sell':
      return 'text-down';
    case 'buy':
    case 'strong-buy':
      return 'text-up';
    default:
      return 'text-muted';
  }
}

export default function TechnicalGauge({ result }: { result: TechnicalSummaryResult }) {
  const { bullCount, bearCount, neutCount } = result;
  const verdict = technicalVerdict(result);

  // Angle de l'aiguille : 180° (vente forte) → 0° (achat fort).
  const needleAngle = 180 - verdict.position * 180;
  const [tipX, tipY] = polar(needleAngle, R - 4);
  const [baseAX, baseAY] = polar(needleAngle - 90, 5);
  const [baseBX, baseBY] = polar(needleAngle + 90, 5);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 124" className="w-full max-w-[300px]" role="img"
        aria-label={`Verdict analyse technique : ${verdict.label}`}>
        {/* Arcs colorés */}
        {ZONES.map((z) => (
          <path
            key={z.tone}
            d={arcPath(z.from, z.to, R)}
            fill="none"
            stroke={z.color}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            opacity={z.tone === verdict.tone ? 1 : 0.32}
          />
        ))}

        {/* Aiguille */}
        <polygon
          points={`${baseAX.toFixed(2)},${baseAY.toFixed(2)} ${tipX.toFixed(2)},${tipY.toFixed(2)} ${baseBX.toFixed(2)},${baseBY.toFixed(2)}`}
          fill="#FCFCFC"
        />
        <circle cx={CX} cy={CY} r={7} fill="#FCFCFC" />
        <circle cx={CX} cy={CY} r={3} fill="#0a1417" />

        {/* Verdict au centre */}
        <text x={CX} y={120} textAnchor="middle"
          className={`font-bold ${toneTextClass(verdict.tone)}`}
          style={{ fontSize: 15, fill: 'currentColor' }}>
          {verdict.label}
        </text>
      </svg>

      {/* Bornes */}
      <div className="w-full max-w-[300px] flex justify-between -mt-1 px-1 text-[9px] uppercase tracking-wide text-faint">
        <span>Vente forte</span>
        <span>Achat fort</span>
      </div>

      {/* Décompte Vente / Neutre / Achat */}
      <div className="mt-3 grid grid-cols-3 gap-2 w-full max-w-[300px] text-center">
        <div>
          <div className="text-down font-mono tabular text-lg font-semibold">{bearCount}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">Vente</div>
        </div>
        <div>
          <div className="text-muted font-mono tabular text-lg font-semibold">{neutCount}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">Neutre</div>
        </div>
        <div>
          <div className="text-up font-mono tabular text-lg font-semibold">{bullCount}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">Achat</div>
        </div>
      </div>
    </div>
  );
}
