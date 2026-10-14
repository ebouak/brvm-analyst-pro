import { fmtNumber } from '@/lib/format';

interface Props {
  score: number;        // 0..100 : part des hausses parmi hausses + baisses
  delta?: number | null; // points de pourcentage vs veille
  hausses?: number | null;
  baisses?: number | null;
}

/** Jauge demi-cercle (SVG) — part des hausses parmi hausses + baisses, 0..100. */
export default function SentimentGauge({ score, delta, hausses, baisses }: Props) {
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
  // Un fait, pas un verdict : « Positif / Neutre » était une lecture par seuils
  // de la même proportion, c'est-à-dire un « sentiment » réintroduit.
  const enMouvement = hausses != null && baisses != null ? hausses + baisses : null;
  const deltaR = delta != null ? Math.round(delta) : null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" width="100%" height="100%" className="max-w-[220px]" aria-hidden>
        <path d={seg(0, 33, '')} className="stroke-down" strokeWidth="11" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d={seg(34, 66, '')} className="stroke-warn" strokeWidth="11" fill="none" opacity="0.85" />
        <path d={seg(67, 100, '')} className="stroke-up" strokeWidth="11" fill="none" strokeLinecap="round" opacity="0.85" />
        {/* aiguille */}
        <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} className="stroke-accent" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" className="fill-accent" />
        <circle cx={cx} cy={cy} r="9" fill="none" className="stroke-accent" strokeOpacity="0.3" strokeWidth="2" />
      </svg>
      <div className="-mt-2 text-center">
        <div className="overline text-faint">Part des hausses</div>
        <div className="tabular mt-1 text-2xl font-bold text-ivory">
          {fmtNumber(s, 0)}<span className="text-sm text-faint"> %</span>
        </div>
        {enMouvement != null && enMouvement > 0 && (
          <div className="tabular mt-0.5 text-xs text-muted">
            {hausses} hausse{hausses! > 1 ? 's' : ''} sur {enMouvement} valeur{enMouvement > 1 ? 's' : ''} en mouvement
          </div>
        )}
        {deltaR != null && (
          <div className={`tabular mt-1 text-xs font-medium ${deltaR === 0 ? 'text-muted' : up ? 'text-up' : 'text-down'}`}>
            vs veille {deltaR > 0 ? '+' : deltaR < 0 ? '−' : ''}{fmtNumber(Math.abs(deltaR), 0)} point{Math.abs(deltaR) > 1 ? 's' : ''}
          </div>
        )}
        <p className="mt-2 max-w-[220px] text-[11px] leading-snug text-faint">
          Part des hausses parmi les valeurs qui ont bougé ; ce n&apos;est pas une mesure du sentiment.
        </p>
      </div>
    </div>
  );
}
