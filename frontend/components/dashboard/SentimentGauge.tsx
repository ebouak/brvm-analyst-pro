interface Props {
  score: number;        // 0..100 (dérivé du breadth)
  delta?: number | null; // points vs veille
}

/** Étiquette de sentiment selon le score (0-100). */
export function sentimentLabel(score: number): string {
  if (score >= 70) return 'Positif';
  if (score >= 55) return 'Neutre positif';
  if (score >= 45) return 'Neutre';
  if (score >= 30) return 'Neutre négatif';
  return 'Négatif';
}

/** Jauge demi-cercle (SVG) — sentiment de marché 0..100. */
export default function SentimentGauge({ score, delta }: Props) {
  const s = Math.max(0, Math.min(100, score));
  // demi-cercle de 180° : angle de l'aiguille (-90° à gauche, +90° à droite)
  const angle = -90 + (s / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 100, cy = 100, r = 78;
  const nx = cx + Math.sin(rad) * (r - 8);
  const ny = cy - Math.cos(rad) * (r - 8);

  // arc segmenté (rouge → ambre → cyan/émeraude)
  const seg = (from: number, to: number, color: string) => {
    const a0 = -90 + (from / 100) * 180;
    const a1 = -90 + (to / 100) * 180;
    const p0 = [cx + Math.sin((a0 * Math.PI) / 180) * r, cy - Math.cos((a0 * Math.PI) / 180) * r];
    const p1 = [cx + Math.sin((a1 * Math.PI) / 180) * r, cy - Math.cos((a1 * Math.PI) / 180) * r];
    return `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${r} ${r} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  };
  const up = (delta ?? 0) >= 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" width="100%" height="100%" className="max-w-[220px]" aria-hidden>
        <path d={seg(0, 33, '')} stroke="#ff6b6b" strokeWidth="11" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d={seg(34, 66, '')} stroke="#f0b23a" strokeWidth="11" fill="none" opacity="0.85" />
        <path d={seg(67, 100, '')} stroke="#3fe18b" strokeWidth="11" fill="none" strokeLinecap="round" opacity="0.85" />
        {/* aiguille */}
        <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="#56d7fd" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#56d7fd" />
        <circle cx={cx} cy={cy} r="9" fill="none" stroke="#56d7fd" strokeOpacity="0.3" strokeWidth="2" />
      </svg>
      <div className="-mt-2 text-center">
        <div className="overline text-faint">Sentiment du marché</div>
        <div className="mt-1 font-display text-lg text-cyan">{sentimentLabel(s)}</div>
        <div className="tabular mt-0.5 text-2xl font-bold text-ivory">
          {s.toFixed(0)}<span className="text-sm text-faint">/100</span>
        </div>
        {delta != null && (
          <div className={`tabular mt-1 text-xs font-medium ${up ? 'text-up' : 'text-down'}`}>
            vs veille {up ? '+' : ''}{delta.toFixed(0)} pts
          </div>
        )}
      </div>
    </div>
  );
}
