import type { ReactElement } from 'react';

export interface CardData {
  code: string;
  dernier: number;
  variation: number | null;
  rsi: number | null;
  date: string;
  closes: number[];
}

/** Sparkline SVG des clôtures RÉELLES (aucune donnée inventée). */
function sparkPath(closes: number[], w: number, h: number): string {
  if (closes.length < 2) return '';
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || 1;
  return closes
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${(i / (closes.length - 1)) * w} ${h - ((c - min) / span) * h}`)
    .join(' ');
}

/** Carte partagée par l'OG (1200×630) et le PNG haute-rés (2400×1260). */
export function HebdoCard({ d, scale }: { d: CardData; scale: number }): ReactElement {
  const w = 1200 * scale, h = 630 * scale;
  const up = (d.variation ?? 0) >= 0;
  return (
    <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#030303', color: '#FCFCFC', padding: 64 * scale }}>
      <div style={{ color: '#56D7FD', fontSize: 24 * scale, letterSpacing: 4 }}>WESTBOURSE · ANALYSE HEBDO</div>
      <div style={{ fontSize: 84 * scale, fontWeight: 700, marginTop: 16 * scale }}>{d.code}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 * scale, marginTop: 8 * scale }}>
        <span style={{ fontSize: 52 * scale }}>{d.dernier} FCFA</span>
        {d.variation != null && (
          <span style={{ fontSize: 40 * scale, color: up ? '#3fe18b' : '#ff6b6b' }}>
            {up ? '+' : ''}{d.variation.toFixed(2)} %
          </span>
        )}
      </div>
      {d.rsi != null && <div style={{ fontSize: 28 * scale, color: '#7a9ea8', marginTop: 8 * scale }}>RSI(14) : {d.rsi.toFixed(1)}</div>}
      <svg width={1000 * scale} height={160 * scale} style={{ marginTop: 24 * scale }}>
        <path d={sparkPath(d.closes, 1000 * scale, 160 * scale)} fill="none" stroke="#56D7FD" strokeWidth={4 * scale} />
      </svg>
      <div style={{ fontSize: 22 * scale, color: '#7a9ea8', marginTop: 16 * scale }}>Semaine du {d.date} · données réelles BRVM</div>
    </div>
  );
}
