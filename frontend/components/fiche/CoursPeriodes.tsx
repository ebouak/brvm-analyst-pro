'use client';

import { useState, type ReactNode } from 'react';
import { fmtNumber, fmtDateCourte, fmtPctSigne } from '@/lib/format';
import type { Periode, SeriePeriode } from '@/lib/fiche/overviewSeries';

type Choix = '1J' | Periode;

const W = 600, H = 200;

/**
 * Graphique de cours de la vue d'ensemble, sélecteur 1J à Max. Les séries sont
 * calculées et sous-échantillonnées côté serveur ; 1J est le graphique de
 * séance (instantanés intraday) rendu par le serveur et passé tel quel.
 */
export function CoursPeriodes({
  series,
  jour,
  variationJour,
  defaut,
}: {
  series: SeriePeriode[];
  jour: ReactNode | null;
  variationJour: number | null;
  defaut: Choix;
}) {
  const choix: Choix[] = [...(jour ? (['1J'] as Choix[]) : []), ...series.map((s) => s.periode)];
  const [actif, setActif] = useState<Choix>(choix.includes(defaut) ? defaut : choix[0] ?? '1J');
  const [survol, setSurvol] = useState<number | null>(null);

  if (choix.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface px-5 py-6">
        <p className="text-xs text-faint">Pas assez de clôtures en base pour tracer le cours.</p>
      </div>
    );
  }

  const serie = actif === '1J' ? null : series.find((s) => s.periode === actif) ?? null;
  const variation = actif === '1J' ? variationJour : serie?.variationPct ?? null;

  return (
    <div className="rounded-card border border-border bg-surface px-4 pb-4 pt-3 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Période du graphique" className="-mx-1 flex flex-wrap gap-0.5">
          {choix.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={c === actif}
              onClick={() => { setActif(c); setSurvol(null); }}
              className={`tabular min-h-[36px] rounded-lg px-2.5 text-xs transition-colors ${c === actif ? 'bg-elevated text-ivory' : 'text-muted hover:text-accent-ink'}`}
            >
              {c}
            </button>
          ))}
        </div>
        {variation != null && Number.isFinite(variation) && (
          <p className="text-xs text-faint">
            <span className={`tabular font-semibold ${Math.round(variation * 100) === 0 ? 'text-ivory' : variation > 0 ? 'text-up' : 'text-down'}`}>
              {fmtPctSigne(variation)}
            </span>{' '}
            {actif === '1J' ? 'sur la séance' : serie ? `depuis le ${fmtDateCourte(serie.debut)}` : ''}
          </p>
        )}
      </div>

      {/* Le graphique de séance a son propre cadre : on l'efface, il est déjà dans celui-ci. */}
      <div className="mt-3 [&>figure]:rounded-none [&>figure]:border-0 [&>figure]:bg-transparent [&>figure]:p-0">
        {actif === '1J' ? jour : serie ? <Courbe serie={serie} survol={survol} setSurvol={setSurvol} /> : null}
      </div>
    </div>
  );
}

function Courbe({ serie, survol, setSurvol }: { serie: SeriePeriode; survol: number | null; setSurvol: (i: number | null) => void }) {
  const pts = serie.points;
  const min = Math.min(...pts.map((p) => p.c)), max = Math.max(...pts.map((p) => p.c));
  const marge = Math.max((max - min) * 0.08, max * 0.005);
  const x = (i: number) => (pts.length === 1 ? 0 : (i / (pts.length - 1)) * W);
  const y = (c: number) => H - ((c - (min - marge)) / (max - min + 2 * marge)) * H;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.c).toFixed(1)}`).join(' ');
  const hausse = serie.variationPct >= 0;
  const couleur = hausse ? 'var(--color-up)' : 'var(--color-down)';
  const pct = (v: number, t: number) => `${(v / t) * 100}%`;
  const p = survol != null ? pts[survol] ?? null : null;

  return (
    <figure>
      <div className="flex gap-2">
        <div
          className="relative min-w-0 flex-1 touch-none"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setSurvol(Math.round(f * (pts.length - 1)));
          }}
          onPointerLeave={() => setSurvol(null)}
          role="img"
          aria-label={`Cours du ${fmtDateCourte(serie.debut)} au ${fmtDateCourte(serie.fin)} : de ${fmtNumber(pts[0]!.c)} à ${fmtNumber(pts[pts.length - 1]!.c)} FCFA, plus bas ${fmtNumber(min)}, plus haut ${fmtNumber(max)}`}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[200px] w-full overflow-visible">
            <path d={`${d} L${W} ${H} L0 ${H} Z`} style={{ fill: `rgb(${couleur} / 0.1)` }} />
            <path d={d} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ stroke: `rgb(${couleur})` }} />
            {[...new Set([min, max])].map((v) => (
              <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} strokeDasharray="2 4" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ stroke: 'rgb(var(--color-border))' }} />
            ))}
            {p && survol != null && (
              <line x1={x(survol)} x2={x(survol)} y1={0} y2={H} strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ stroke: 'rgb(var(--color-border-strong))' }} />
            )}
          </svg>
          {p && survol != null && (
            <div
              className="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-muted"
              style={{ left: pct(x(survol), W), transform: survol > pts.length / 2 ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)' }}
            >
              {fmtDateCourte(p.d)} · <span className="tabular text-ivory">{fmtNumber(p.c)}</span>
            </div>
          )}
          <div className="relative mt-1 flex h-4 justify-between">
            <span className="tabular whitespace-nowrap text-[11px] text-faint">{fmtDateCourte(serie.debut)}</span>
            <span className="tabular whitespace-nowrap text-[11px] text-faint">{fmtDateCourte(serie.fin)}</span>
          </div>
        </div>
        <div className="relative h-[200px] w-14 shrink-0">
          {[...new Set([min, max])].map((v) => (
            <span key={v} className="tabular absolute left-0 -translate-y-1/2 whitespace-nowrap text-[11px] text-faint" style={{ top: pct(y(v), H) }}>
              {fmtNumber(v)}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-[11px] text-faint">Clôtures de séance en FCFA, cote BRVM, telles que publiées : non ajustées des opérations sur titres. Plus bas et plus haut de la période en pointillés.</figcaption>
    </figure>
  );
}
