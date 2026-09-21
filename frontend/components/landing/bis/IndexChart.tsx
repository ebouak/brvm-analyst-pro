'use client';

import { useMemo, useState } from 'react';
import type { Point } from '@/lib/landing/bisData';

/**
 * Courbe des clôtures du BRVM Composite. Trois fenêtres : 1 mois (≈ 21
 * séances), 3 mois (≈ 63), 1 an (≈ 250). Pas d'onglet « 1 jour » : la BRVM
 * ne publie pas l'indice en intraday et nous n'en avons pas de série — on ne
 * dessine pas ce qu'on n'a pas. Axe Y gradué sur les valeurs réellement
 * atteintes ; texte en jetons du thème.
 */

const FENETRES = [
  { k: '1M', n: 21 },
  { k: '3M', n: 63 },
  { k: '1A', n: 250 },
] as const;

const W = 640, H = 220, PL = 8, PR = 52, PT = 12, PB = 28;

const fmtV = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}${y ? '' : ''}`; };

export function IndexChart({ serie }: { serie: Point[] }) {
  const [k, setK] = useState<(typeof FENETRES)[number]['k']>('1M');
  const n = FENETRES.find((f) => f.k === k)?.n ?? 21;
  const pts = useMemo(() => serie.slice(-n), [serie, n]);
  // SMA 20 calculée sur la série COMPLÈTE (les 19 séances avant la fenêtre
  // comptent), puis découpée : la moyenne est juste dès le premier point.
  const sma = useMemo(() => {
    const out: (number | null)[] = serie.map((_, i) => i < 19 ? null : serie.slice(i - 19, i + 1).reduce((a, p) => a + p.v, 0) / 20);
    return out.slice(-n);
  }, [serie, n]);

  if (pts.length < 2) return <p className="empty">Pas assez de séances pour tracer la courbe.</p>;

  const smaVals = sma.filter((v): v is number => v != null);
  const vals = [...pts.map((p) => p.v), ...smaVals];
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min || 1) * 0.08;
  const lo = min - pad, hi = max + pad;
  const x = (i: number) => PL + (i / (pts.length - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${(H - PB).toFixed(1)} L${PL} ${(H - PB).toFixed(1)} Z`;
  const smaLine = sma.map((v, i) => v == null ? null : `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).filter(Boolean).map((seg, i) => `${i ? 'L' : 'M'}${seg}`).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const xLabels = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  const dernier = pts[pts.length - 1];
  const premier = pts[0];
  const varFen = ((dernier.v - premier.v) / premier.v) * 100;

  return (
    <div className="chart">
      <div className="chart-head">
        <div className="tabs" role="tablist" aria-label="Fenêtre">
          {FENETRES.map((f) => (
            <button key={f.k} type="button" role="tab" aria-selected={f.k === k} onClick={() => setK(f.k)} disabled={serie.length < 2}>{f.k}</button>
          ))}
        </div>
        <span className="legend"><i className="sw sma" aria-hidden="true" />SMA 20</span>
        <span className={`num chart-var ${varFen >= 0 ? 'up' : 'down'}`} aria-label={`Variation sur la fenêtre ${k}`}>
          {varFen >= 0 ? '+' : '−'}{Math.abs(varFen).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % <small>sur {k === '1M' ? '1 mois' : k === '3M' ? '3 mois' : '1 an'}</small>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`BRVM Composite, ${pts.length} séances, de ${fmtV(premier.v)} à ${fmtV(dernier.v)}`}>
        <defs><linearGradient id="lb-idx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--color-accent))" stopOpacity=".35" /><stop offset="1" stopColor="rgb(var(--color-accent))" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity=".12" />
            <text x={W - PR + 8} y={y(t) + 4} fontSize="11" fill="currentColor" fillOpacity=".7" className="num">{fmtV(t)}</text>
          </g>
        ))}
        <path d={area} fill="url(#lb-idx)" />
        <path d={line} fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2" strokeLinejoin="round" />
        {smaLine && <path d={smaLine} fill="none" stroke="rgb(var(--color-accent))" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" />}
        <circle cx={x(pts.length - 1)} cy={y(dernier.v)} r="3.5" fill="rgb(var(--color-accent))" stroke="rgb(var(--color-surface))" strokeWidth="1.5" />
        {xLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="currentColor" fillOpacity=".7" textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>{fmtD(pts[i].d)}</text>
        ))}
      </svg>
    </div>
  );
}
