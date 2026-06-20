import SignalBadge from '@/components/SignalBadge';
import RatingBadge from '@/components/RatingBadge';
import Sparkline from '@/components/Sparkline';
import { fmtNumber } from '@/lib/format';

/**
 * Bandeau « verdict » de la fiche action : la conclusion en un coup d'œil —
 * note A–F, signal du jour, tendance (sparkline), position dans le range et une
 * phrase de synthèse. Server Component (aucune donnée inventée : tout dérive des
 * signaux et de l'historique réels passés en props).
 */
export function VerdictBand({
  signal,
  scoreTotal,
  confiance,
  sparkData,
  up,
  cours,
  low52,
  high52,
  synthesisLine,
}: {
  signal: string | null;
  scoreTotal: number | null;
  confiance: number | null;
  sparkData: number[];
  up: boolean;
  cours: number | null;
  low52: number | null;
  high52: number | null;
  synthesisLine?: string | null;
}) {
  // Position du cours dans le range (0 = plus bas, 1 = plus haut).
  const pos =
    cours != null && low52 != null && high52 != null && high52 > low52
      ? Math.max(0, Math.min(1, (cours - low52) / (high52 - low52)))
      : null;

  return (
    <div className="rounded-panel border border-border/60 bg-surface px-4 py-3.5 md:px-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Note A–F */}
        <div className="flex items-center gap-2">
          <span className="overline text-faint">Note</span>
          <RatingBadge scoreTotal={scoreTotal} confiance={confiance} />
        </div>

        {/* Signal */}
        <div className="flex items-center gap-2">
          <span className="overline text-faint">Signal</span>
          {signal ? <SignalBadge signal={signal as 'BUY' | 'SELL' | 'HOLD'} confiance={confiance} /> : <span className="text-xs text-faint">—</span>}
        </div>

        {/* Tendance (sparkline) */}
        {sparkData.length >= 2 && (
          <div className="flex items-center gap-2">
            <span className="overline text-faint">Tendance</span>
            <Sparkline data={sparkData} up={up} width={96} height={26} />
          </div>
        )}

        {/* Position 52 sem */}
        {pos != null && (
          <div className="min-w-[180px] flex-1">
            <div className="flex items-center justify-between text-[10px] text-faint mb-1">
              <span className="tabular">{fmtNumber(low52)}</span>
              <span className="overline">Plage observée</span>
              <span className="tabular">{fmtNumber(high52)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-border">
              <span
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-surface bg-gold"
                style={{ left: `${pos * 100}%` }}
                aria-hidden
              />
            </div>
          </div>
        )}
      </div>

      {synthesisLine && (
        <p className="mt-3 border-t border-border/40 pt-3 text-sm leading-relaxed text-muted">
          {synthesisLine}
        </p>
      )}
    </div>
  );
}
