import type { CourbeEvenement as Courbe } from '@/lib/evenements/courbe';
import { fmtDateCourte } from '@/lib/format';

const L = 640;
const H = 220;
const MARGE = { g: 44, d: 12, h: 14, b: 26 };

/**
 * Cours du titre et indice BRVM Composite, ramenés à 100 en J0, de J−10 à J+10.
 * SVG rendu côté serveur (pas de bibliothèque client) ; J0 marqué d'un filet vertical.
 */
export default function CourbeEvenement({ courbe, code }: { courbe: Courbe; code: string }) {
  const { points } = courbe;
  const valeurs = points.flatMap((p) => [p.titre, p.indice]).filter((v): v is number => v != null);
  if (points.length < 2 || valeurs.length === 0) return null;
  const min = Math.min(...valeurs, 100);
  const max = Math.max(...valeurs, 100);
  const marge = (max - min || 1) * 0.1;
  const lo = min - marge;
  const hi = max + marge;
  const dMin = points[0]!.decalage;
  const dMax = points[points.length - 1]!.decalage;
  const x = (d: number) => MARGE.g + ((d - dMin) / Math.max(1, dMax - dMin)) * (L - MARGE.g - MARGE.d);
  const y = (v: number) => MARGE.h + (1 - (v - lo) / (hi - lo)) * (H - MARGE.h - MARGE.b);
  const trace = (cle: 'titre' | 'indice') => {
    let d = '';
    let ouvert = false;
    for (const p of points) {
      const v = p[cle];
      if (v == null) { ouvert = false; continue; }
      d += `${ouvert ? 'L' : 'M'}${x(p.decalage).toFixed(1)},${y(v).toFixed(1)} `;
      ouvert = true;
    }
    return d.trim();
  };
  const graduations = [lo + marge, 100, hi - marge];
  return (
    <figure>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Cours de ${code} et de l’indice BRVM Composite, base 100 au jour de la publication`} className="h-auto w-full">
        {graduations.map((g, i) => (
          <g key={i}>
            <line x1={MARGE.g} x2={L - MARGE.d} y1={y(g)} y2={y(g)} className="stroke-border" strokeWidth={1} strokeDasharray={g === 100 ? undefined : '3 4'} />
            <text x={MARGE.g - 6} y={y(g) + 4} textAnchor="end" className="fill-muted tabular" fontSize={11}>{g.toFixed(0)}</text>
          </g>
        ))}
        <line x1={x(0)} x2={x(0)} y1={MARGE.h} y2={H - MARGE.b} className="stroke-accent" strokeWidth={1.5} />
        <text x={x(0) + 5} y={MARGE.h + 10} className="fill-accent-ink" fontSize={11}>J0 · {fmtDateCourte(courbe.j0Date)}</text>
        <path d={trace('indice')} fill="none" className="stroke-muted" strokeWidth={1.75} strokeDasharray="5 4" />
        <path d={trace('titre')} fill="none" className="stroke-accent" strokeWidth={2.25} strokeLinejoin="round" />
        {[dMin, 0, dMax].map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-muted tabular" fontSize={11}>
            {d === 0 ? 'J0' : d > 0 ? `J+${d}` : `J−${-d}`}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-5 bg-accent" />{code}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-muted" />BRVM Composite</span>
        <span>Base 100 le jour de la publication.</span>
      </figcaption>
    </figure>
  );
}
