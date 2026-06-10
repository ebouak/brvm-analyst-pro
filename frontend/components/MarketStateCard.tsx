import { BarChart3, TrendingUp, TrendingDown, Minus, Activity } from '@/components/icons';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import SentimentGauge from '@/components/dashboard/SentimentGauge';

export interface MarketStats {
  hausses: number;
  baisses: number;
  stables: number;
  total: number;
  volumeTotal: number | null;
  volumeEstimated: boolean;
  volumePrev: number | null;
  titresEchanges: number | null;
  transactions: number | null;
}

export interface Mover { code: string; cours: number | null; variation: number }
export interface Breakdown { hausses: Mover[]; baisses: Mover[]; stables: Mover[] }

/** Info-bulle (CSS pur) listant les valeurs d'un mouvement, au survol/focus de la pastille. */
function MoverTooltip({ rows, label }: { rows: Mover[]; label: string }) {
  if (rows.length === 0) return null;
  return (
    <div
      role="tooltip"
      className="
        pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2
        origin-top scale-95 opacity-0 transition-all duration-150
        group-hover:scale-100 group-hover:opacity-100
        group-focus-within:scale-100 group-focus-within:opacity-100
        rounded-card border border-border-strong bg-elevated p-2 shadow-modal
      "
    >
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wider text-faint">{label}</span>
        <span className="tabular text-[10px] text-muted">{rows.length}</span>
      </div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto pr-0.5">
        {rows.map((m) => {
          const up = m.variation > 0;
          const flat = m.variation === 0;
          return (
            <div key={m.code} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-surface">
              <span className="font-medium text-ivory/85">{m.code}</span>
              <span className={`tabular font-medium ${flat ? 'text-muted' : up ? 'text-up' : 'text-down'}`}>
                {up ? '+' : ''}{m.variation.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BreadthBadge({ ratio }: { ratio: number }) {
  const { cls, label } = ratio >= 60
    ? { cls: 'border-up/25 bg-up/10 text-up',     label: 'Haussier' }
    : ratio <= 40
    ? { cls: 'border-down/25 bg-down/10 text-down', label: 'Baissier' }
    : { cls: 'border-warn/25 bg-warn/10 text-warn', label: 'Neutre'   };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-semibold tracking-wide uppercase tabular ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ratio >= 60 ? 'bg-up' : ratio <= 40 ? 'bg-down' : 'bg-warn'}`} />
      {label} {ratio.toFixed(0)}%
    </span>
  );
}

const PILL_CONFIGS = [
  {
    key: 'hausses',
    label: 'Hausse',
    icon: (s: number) => <TrendingUp size={s} />,
    cls: 'border-up/20 bg-up/[0.07] text-up hover:bg-up/12 hover:border-up/30',
    valueCls: 'text-up',
  },
  {
    key: 'baisses',
    label: 'Baisse',
    icon: (s: number) => <TrendingDown size={s} />,
    cls: 'border-down/20 bg-down/[0.07] text-down hover:bg-down/12 hover:border-down/30',
    valueCls: 'text-down',
  },
  {
    key: 'stables',
    label: 'Stable',
    icon: (s: number) => <Minus size={s} />,
    cls: 'border-border bg-elevated text-muted hover:border-border-strong',
    valueCls: 'text-muted',
  },
  {
    key: 'total',
    label: 'Titres',
    icon: (s: number) => <Activity size={s} />,
    cls: 'border-border-strong bg-elevated text-ivory/70 hover:border-gold/20',
    valueCls: 'text-ivory',
  },
] as const;

export default function MarketStateCard({
  stats,
  sentimentScore,
  sentimentDelta,
  breakdown,
}: {
  stats: MarketStats;
  sentimentScore?: number;
  sentimentDelta?: number | null;
  breakdown?: Breakdown;
}) {
  // Delta volume : seulement si valeur réelle (non estimée) et veille comparable
  const volPct = !stats.volumeEstimated && stats.volumeTotal != null && stats.volumePrev && stats.volumePrev > 0
    ? ((stats.volumeTotal - stats.volumePrev) / stats.volumePrev) * 100
    : null;
  const volUp = (volPct ?? 0) >= 0;

  const breadth = stats.hausses + stats.baisses > 0
    ? (stats.hausses / (stats.hausses + stats.baisses)) * 100
    : 50;

  const hPct = stats.total > 0 ? (stats.hausses / stats.total) * 100 : 0;
  const bPct = stats.total > 0 ? (stats.baisses / stats.total) * 100 : 0;
  const sPct = Math.max(0, 100 - hPct - bPct);

  const values: Record<string, number> = {
    hausses: stats.hausses,
    baisses: stats.baisses,
    stables: stats.stables,
    total:   stats.total,
  };

  return (
    /* Outer shell */
    <div className="rounded-panel border border-border bg-border/30 p-1.5">
      {/* Inner core */}
      <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] px-4 py-3.5">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-border-strong bg-elevated text-muted">
              <Activity size={12} />
            </span>
            <h3 className="text-sm font-semibold text-ivory">État du marché</h3>
          </div>
          {stats.hausses + stats.baisses > 0 && <BreadthBadge ratio={breadth} />}
        </div>

        <div className={sentimentScore != null ? 'grid gap-4 lg:grid-cols-[1fr_minmax(0,200px)] lg:items-center' : ''}>
        <div>
        {/* KPI pills — 4 colonnes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
          {PILL_CONFIGS.map((cfg) => {
            const rows = breakdown
              ? cfg.key === 'hausses' ? breakdown.hausses
              : cfg.key === 'baisses' ? breakdown.baisses
              : cfg.key === 'stables' ? breakdown.stables
              : []
              : [];
            const interactive = rows.length > 0;
            return (
              <div
                key={cfg.key}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? `${cfg.label} : ${values[cfg.key]} valeurs` : undefined}
                className={`
                  group relative flex items-center justify-between rounded-card border px-3 py-2
                  transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                  outline-none focus-visible:ring-2 focus-visible:ring-gold/40
                  ${interactive ? 'cursor-help' : 'cursor-default'} ${cfg.cls}
                `}
              >
                <div className="flex items-center gap-1.5 opacity-70">
                  {cfg.icon(13)}
                  <span className="text-[10px] uppercase tracking-wider opacity-80 font-medium">{cfg.label}</span>
                </div>
                <div className={`tabular text-lg font-bold leading-none ${cfg.valueCls}`}>
                  {values[cfg.key]}
                </div>
                {interactive && <MoverTooltip rows={rows} label={cfg.label} />}
              </div>
            );
          })}
        </div>

        {/* Barre breadth empilée — premium (SVG pour éviter inline styles) */}
        {stats.total > 0 && (
          <div className="mb-3">
            <svg
              viewBox="0 0 100 8"
              width="100%"
              height="8"
              preserveAspectRatio="none"
              className="rounded-full overflow-hidden"
              aria-hidden
            >
              {/* hausse — émeraude */}
              <rect x="0" y="0" width={hPct} height="8" fill="rgba(22,180,106,0.55)" rx="4" />
              {/* stable — neutre */}
              <rect x={hPct} y="0" width={sPct} height="8" fill="rgba(152,147,132,0.25)" />
              {/* baisse — rubis */}
              <rect x={hPct + sPct} y="0" width={bPct} height="8" fill="rgba(226,75,75,0.55)" rx="4" />
            </svg>
            <div className="flex justify-between mt-1.5 text-[10px] text-faint">
              <span>{hPct.toFixed(0)}% hausse</span>
              <span>{bPct.toFixed(0)}% baisse</span>
            </div>
          </div>
        )}

        {/* Footer — valeur échangée + titres + transactions (gestion des absences) */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-3 border-t border-border/40 text-xs text-muted">
          <span title={stats.volumeEstimated ? 'Estimation : cours × titres échangés (valeur officielle non publiée en intraday)' : undefined}>
            Valeur échangée{' '}
            {stats.volumeTotal != null ? (
              <span className="tabular text-ivory/80 font-medium">
                {stats.volumeEstimated && <span className="text-faint">≈ </span>}
                {fmtFcfa(stats.volumeTotal)} FCFA
              </span>
            ) : (
              <span className="text-faint">non disponible</span>
            )}
            {volPct != null && (
              <span className={`ml-1.5 tabular font-semibold ${volUp ? 'text-up' : 'text-down'}`}>
                {volUp ? '▲' : '▼'}{Math.abs(volPct).toFixed(1)}%
              </span>
            )}
          </span>
          <span>
            Titres échangés{' '}
            {stats.titresEchanges != null ? (
              <span className="tabular text-ivory/80 font-medium">{fmtNumber(stats.titresEchanges)}</span>
            ) : (
              <span className="text-faint">—</span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 size={11} className="text-faint" />
            Transactions{' '}
            {stats.transactions != null ? (
              <span className="tabular text-ivory/80 font-medium">{fmtNumber(stats.transactions)}</span>
            ) : (
              <span className="text-faint">—</span>
            )}
          </span>
        </div>
        </div>

        {/* Jauge de sentiment (dérivée du breadth) */}
        {sentimentScore != null && (
          <div className="border-t border-border/40 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
            <SentimentGauge score={sentimentScore} delta={sentimentDelta} />
          </div>
        )}
        </div>

      </div>
    </div>
  );
}
