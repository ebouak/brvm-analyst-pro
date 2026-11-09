import type React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { SectorPerf } from '@/lib/sectors';
import { fmtFcfa, fmtPctSigne } from '@/lib/format';

interface Props {
  perf: SectorPerf;
  /** Rang dans le classement du jour (1 = plus forte variation). Facultatif. */
  rang?: number;
}

const FOCUS = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** Courbe de la performance cumulée sur 30 jours. Couleur par jeton (suit le thème). */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const W = 120;
  const H = 32;
  const step = W / (data.length - 1);
  const y = (v: number) => H - ((v - min) / range) * H;

  const points = data.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = data[data.length - 1] ?? 0;
  const zero = min < 0 && max > 0 ? y(0) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`h-8 w-full overflow-visible ${last >= 0 ? 'text-up' : 'text-down'}`}
      aria-hidden
    >
      {zero != null && (
        <line x1="0" x2={W} y1={zero} y2={zero} className="stroke-border" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function SectorCard({ perf, rang }: Props) {
  const { secteur, count, varDay, var30d, volumeDay, sparkline30d, topHausse, topBaisse, hausses, baisses } = perf;
  const varColor = varDay == null ? 'text-muted' : varDay > 0 ? 'text-up' : varDay < 0 ? 'text-down' : 'text-muted';
  const Fleche = varDay == null || varDay === 0 ? null : varDay > 0 ? TrendingUp : TrendingDown;
  const mouvements = hausses + baisses;
  const partHausse = mouvements > 0 ? (hausses / mouvements) * 100 : null;

  return (
    <article className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-card">
      {/* En-tête : rang, secteur, variation de la séance */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {rang != null && <span className="tabular text-xs text-accent-ink">{String(rang).padStart(2, '0')}</span>}
          <h3 className="text-base font-semibold leading-snug text-ivory [text-wrap:balance]">
            <Link href={`/heatmap?secteur=${encodeURIComponent(secteur)}`} className={`transition-colors hover:text-accent-ink ${FOCUS}`}>
              {secteur}
            </Link>
          </h3>
        </div>
        <p className={`flex shrink-0 items-center gap-1 ${varColor}`}>
          {Fleche && <Fleche size={16} strokeWidth={1.75} aria-hidden />}
          <span className="tabular text-xl font-semibold">{varDay == null ? '—' : fmtPctSigne(varDay)}</span>
        </p>
      </header>

      {/* Largeur : part des valeurs en hausse parmi celles qui ont bougé */}
      <div>
        {partHausse != null ? (
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-down/70"
            role="img"
            aria-label={`${hausses} en hausse, ${baisses} en baisse`}
          >
            <div
              className="h-full bg-up [width:var(--part)]"
              style={{ '--part': `${partHausse.toFixed(0)}%` } as React.CSSProperties}
            />
          </div>
        ) : (
          <div className="h-1.5 rounded-full bg-border" aria-hidden />
        )}
        <p className="mt-1.5 flex items-center justify-between text-xs text-muted">
          {partHausse != null ? (
            <>
              <span><span className="tabular text-ivory">{hausses}</span> en hausse</span>
              <span><span className="tabular text-ivory">{baisses}</span> en baisse</span>
            </>
          ) : (
            <span>Aucune valeur n&apos;a bougé sur la séance</span>
          )}
        </p>
      </div>

      {/* Valeurs extrêmes du secteur sur la séance */}
      {(topHausse || topBaisse) && (
        <dl className="space-y-1 text-xs">
          {topHausse && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Plus forte hausse</dt>
              <dd className="flex items-center gap-2">
                <Link href={`/actions/${topHausse.code}`} className={`font-medium text-ivory hover:text-accent-ink ${FOCUS}`}>
                  {topHausse.code}
                </Link>
                <span className="tabular text-up">{fmtPctSigne(topHausse.pct)}</span>
              </dd>
            </div>
          )}
          {topBaisse && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Plus forte baisse</dt>
              <dd className="flex items-center gap-2">
                <Link href={`/actions/${topBaisse.code}`} className={`font-medium text-ivory hover:text-accent-ink ${FOCUS}`}>
                  {topBaisse.code}
                </Link>
                <span className="tabular text-down">{fmtPctSigne(topBaisse.pct)}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Tendance sur 30 jours */}
      {(var30d != null || sparkline30d.length >= 2) && (
        <div>
          <p className="flex items-baseline justify-between text-xs text-muted">
            <span>Sur 30 jours</span>
            {var30d != null && (
              <span className={`tabular ${var30d > 0 ? 'text-up' : var30d < 0 ? 'text-down' : 'text-muted'}`}>{fmtPctSigne(var30d)}</span>
            )}
          </p>
          <div className="mt-1.5">
            <Sparkline data={sparkline30d} />
          </div>
        </div>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted">
        <span>
          <span className="tabular text-ivory">{count}</span> valeur{count > 1 ? 's' : ''}
          <span aria-hidden className="mx-1.5 text-faint">·</span>
          <span className="tabular text-ivory">{fmtFcfa(volumeDay)}</span> FCFA échangés
        </span>
        <Link
          href={`/actions?secteur=${encodeURIComponent(secteur)}`}
          className={`inline-flex min-h-[44px] items-center gap-1 text-accent-ink transition-colors hover:underline sm:min-h-0 ${FOCUS}`}
        >
          Voir les valeurs
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </Link>
      </footer>
    </article>
  );
}
