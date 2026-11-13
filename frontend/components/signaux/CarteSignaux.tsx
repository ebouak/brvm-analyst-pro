import { pointsCarte, quadrant, LIBELLE_QUADRANT, type SousScores, type Quadrant } from '@/lib/signals/carte';

/**
 * Carte des signaux : élan (variation + MACD) en abscisse, position du RSI en
 * ordonnée. Rendu serveur, SVG pur, aucune dépendance client. Le texte porte
 * l'information (codes, libellés de quadrant), la couleur ne fait que la doubler.
 */
const L = 640;
const H = 400;
const M = 36;
const x = (t: number) => M + ((t + 1) / 2) * (L - 2 * M);
const y = (s: number) => H - M - ((s + 1) / 2) * (H - 2 * M);

const TON: Record<string, string> = { BUY: 'text-up', SELL: 'text-down' };

export default function CarteSignaux({ lignes, date }: { lignes: SousScores[]; date: string | null }) {
  const { points, ecartees } = pointsCarte(lignes);
  if (points.length < 5) return null;
  const parQuadrant = points.reduce<Record<Quadrant, string[]>>(
    (acc, p) => {
      acc[quadrant(p)].push(p.code);
      return acc;
    },
    { hausse_survendu: [], hausse_surachete: [], baisse_survendu: [], baisse_surachete: [] },
  );

  return (
    <figure className="rounded-card border border-border bg-surface shadow-card p-5 space-y-3">
      <figcaption className="space-y-1">
        <h2 className="font-display text-lg text-ivory">Carte des signaux</h2>
        <p className="text-sm text-muted">
          Ce que le score composite additionne, séparé en deux axes : l&apos;élan du cours (variation et MACD) et la
          position du RSI. Une valeur en forte hausse mais surachetée s&apos;annule dans le score ; ici, elle se voit.
          {date && <> Séance notée du {date.split('-').reverse().join('/')}.</>}
        </p>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Nuage de points : élan du cours en abscisse, position du RSI en ordonnée" className="w-full h-auto">
        <rect x={M} y={M} width={L - 2 * M} height={H - 2 * M} className="fill-transparent stroke-current text-border" />
        <line x1={x(0)} x2={x(0)} y1={M} y2={H - M} className="stroke-current text-border" strokeDasharray="3 4" />
        <line x1={M} x2={L - M} y1={y(0)} y2={y(0)} className="stroke-current text-border" strokeDasharray="3 4" />
        <text x={L - M} y={H - 10} textAnchor="end" className="fill-current text-faint text-[11px]">élan haussier →</text>
        <text x={M} y={H - 10} className="fill-current text-faint text-[11px]">← élan baissier</text>
        <text x={8} y={M + 4} className="fill-current text-faint text-[11px]">RSI bas</text>
        <text x={8} y={H - M} className="fill-current text-faint text-[11px]">RSI haut</text>
        {points.map((p) => (
          <g key={p.code} className={`${TON[p.signal ?? ''] ?? 'text-muted'}`}>
            <circle cx={x(p.tendance)} cy={y(p.survente)} r={3.5} className="fill-current" />
            <text x={x(p.tendance) + 5} y={y(p.survente) - 4} className="fill-current text-[9px] font-mono">{p.code}</text>
          </g>
        ))}
      </svg>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        {(Object.keys(parQuadrant) as Quadrant[]).map((q) => (
          <div key={q} className="rounded-lg border border-border/60 px-3 py-2">
            <dt className="text-muted">{LIBELLE_QUADRANT[q]} <span className="tabular text-faint">({parQuadrant[q].length})</span></dt>
            <dd className="font-mono text-ivory">{parQuadrant[q].length ? parQuadrant[q].sort().join(' · ') : '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-faint">
        Lecture des sous-scores publiés, sans nouveau calcul de signal. Une position sur la carte décrit des
        indicateurs, ce n&apos;est pas une recommandation.
        {ecartees > 0 && <> {ecartees} valeur{ecartees > 1 ? 's' : ''} sans RSI ou sans élan calculé, non placée{ecartees > 1 ? 's' : ''}.</>}
      </p>
    </figure>
  );
}
