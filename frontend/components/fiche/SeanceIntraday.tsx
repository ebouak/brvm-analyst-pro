import { fmtNumber } from '@/lib/format';
import { reperesHoraires, reperesPrix, heureReleve } from '@/lib/fiche/seance';

const DEBUT = 9 * 60 + 15, FIN = 15 * 60 + 45, W = 520, H = 150, VH = 40;

export function SeanceIntraday({ points, plusBasPublie }: { points: { captured_at: string; close: number | null; volume: number | null }[]; plusBasPublie: number | null }) {
  const brut = [...points]
    .sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))
    .filter((p) => p.close != null && p.close > 0)
    .map((p) => { const d = new Date(p.captured_at); return { m: d.getUTCHours() * 60 + d.getUTCMinutes(), c: p.close as number, v: p.volume ?? 0 }; })
    .filter((p) => p.m >= DEBUT && p.m <= FIN);
  // Un relevé par minute : le dernier de la minute l'emporte (relevés triés par heure ci-dessus).
  const parMinute = new Map<number, { m: number; c: number; v: number }>();
  for (const p of brut) parMinute.set(p.m, p);
  const pts = [...parMinute.values()].sort((a, b) => a.m - b.m);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.c)), max = Math.max(...pts.map((p) => p.c));
  const marge = Math.max((max - min) * 0.15, max * 0.005);
  const x = (m: number) => ((m - DEBUT) / (FIN - DEBUT)) * W;
  const y = (c: number) => H - ((c - (min - marge)) / (max - min + 2 * marge)) * H;
  let d = `M0 ${y(pts[0]!.c).toFixed(1)}`;
  for (const p of pts.slice(1)) d += ` H${x(p.m).toFixed(1)} V${y(p.c).toFixed(1)}`;
  d += ` H${W}`;
  // Le volume des instantanés est CUMULÉ : on trace la différence entre deux relevés.
  const barres = pts.slice(1).map((p, i) => ({ x: x(p.m), v: Math.max(0, p.v - pts[i]!.v) })).filter((b) => b.v > 0);
  const vmax = Math.max(1, ...barres.map((b) => b.v));
  const dernierReleve = heureReleve(points.map((p) => p.captured_at).sort().at(-1) ?? '');
  const hausse = pts[pts.length - 1]!.c >= pts[0]!.c;
  const couleur = hausse ? 'var(--color-up)' : 'var(--color-down)';
  // Le tracé seul est dans le SVG (étiré, traits non redimensionnés) ; prix et heures sont en HTML
  // positionné : ils gardent 11 px à toute largeur au lieu de suivre l'échelle du viewBox.
  const pct = (v: number, t: number) => `${(v / t) * 100}%`;
  const reperes = reperesHoraires();
  return (
    <figure className="rounded-card border border-border bg-surface px-5 pb-3.5 pt-5">
      <figcaption className="text-xs text-faint">Séance du jour · cours et volume par intervalle de 15 minutes{dernierReleve ? `, dernier relevé à ${dernierReleve}` : ''}</figcaption>
      <div className="mt-3 flex gap-2" role="img" aria-label={`Séance : de ${pts[0]!.c} à ${pts[pts.length - 1]!.c}, plus bas relevé ${min}, plus haut relevé ${max}`}>
        <div className="min-w-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H + VH + 6}`} preserveAspectRatio="none" className="block h-[190px] w-full overflow-visible">
            <path d={`${d} V${H} H0 Z`} style={{ fill: `rgb(${couleur} / 0.1)` }} />
            <path d={d} fill="none" strokeWidth={2.5} vectorEffect="non-scaling-stroke" style={{ stroke: `rgb(${couleur})` }} />
            {reperesPrix(min, max).map((r) => (
              <line key={r.valeur} x1={0} x2={W} y1={y(r.valeur)} y2={y(r.valeur)} strokeDasharray="2 4" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ stroke: 'rgb(var(--color-border))' }} />
            ))}
            <g transform={`translate(0,${H + VH + 6})`}>
              {barres.map((b, i) => <rect key={i} x={b.x - 3} y={-(b.v / vmax) * VH} width={6} height={(b.v / vmax) * VH} style={{ fill: 'rgb(var(--color-border-strong))' }} />)}
            </g>
          </svg>
          <div className="relative mt-1 h-4">
            {reperes.map((r, i, a) => (
              <span key={r.m} className="tabular absolute whitespace-nowrap text-[11px] text-faint"
                style={{ left: pct(x(r.m), W), transform: i === 0 ? 'none' : i === a.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{r.libelle}</span>
            ))}
          </div>
        </div>
        <div className="relative h-[190px] w-14 shrink-0">
          {reperesPrix(min, max).map((r) => (
            <span key={r.valeur} className="tabular absolute left-0 -translate-y-1/2 whitespace-nowrap text-[11px] text-faint"
              style={{ top: pct(y(r.valeur), H + VH + 6) }}>{fmtNumber(r.valeur)}</span>
          ))}
        </div>
      </div>
      {plusBasPublie != null && min < plusBasPublie && (
        <p className="mt-1 text-[11px] text-faint">Plus bas relevé en séance : <span className="tabular">{fmtNumber(min)}</span> · plus bas de la cote publiée : <span className="tabular">{fmtNumber(plusBasPublie)}</span>.</p>
      )}
    </figure>
  );
}
