import { libelleSignal } from '@/lib/signalLabel';
import Sparkline from '@/components/Sparkline';
import { fmtNumber } from '@/lib/format';

/**
 * Bandeau « verdict » de la fiche action : la conclusion en un coup d'œil —
 * note A–F, signal du jour, tendance (sparkline), position dans le range et une
 * phrase de synthèse. Server Component (aucune donnée inventée : tout dérive des
 * signaux et de l'historique réels passés en props).
 */
export function VerdictBand({
  note,
  signal,
  scoreTotal,
  confiance,
  sparkData,
  up,
  cours,
  low52,
  high52,
  synthesisLine,
  libelleNote,
}: {
  /** Notation financière A à F (null si non notée). */
  note: string | null;
  signal: string | null;
  scoreTotal: number | null;
  confiance: number | null;
  sparkData: number[];
  up: boolean;
  cours: number | null;
  low52: number | null;
  high52: number | null;
  synthesisLine?: string | null;
  /** Libellé de la note (« Momentum positif ») : B+ et Attente se lisent ensemble. */
  libelleNote?: string | null;
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
        {note && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-faint">Note</span>
            <span className="font-display rounded-[10px] border border-ivory px-3 py-1.5 text-3xl leading-none text-ivory">{note}</span>
            <span className="max-w-[150px] text-[11px] leading-snug text-faint">
              {libelleNote && <span className="block text-xs text-muted">{libelleNote}</span>}
              note technique A à F, tirée du même score
            </span>
          </div>
        )}

        {/* Signal */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint">Signal</span>
          {signal ? (
            <span className="inline-flex items-baseline gap-2 text-sm text-ivory">
              <span className="font-semibold">{libelleSignal(signal)}</span>
              {scoreTotal != null && (
                <span className="tabular text-xs text-muted">
                  score {scoreTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              {signal === 'HOLD' && note && <span className="text-xs text-faint">sous le seuil d&apos;achat</span>}
              {confiance != null && <span className="text-xs text-faint">qualité des données <span className="tabular">{Math.round(confiance <= 1 ? confiance * 100 : confiance)} %</span></span>}
            </span>
          ) : (
            <span className="text-xs text-faint">—</span>
          )}
        </div>

        {/* Tendance (sparkline) */}
        {sparkData.length >= 2 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-faint">Tendance</span>
            <span className="text-muted"><Sparkline data={sparkData} up={up} width={96} height={26} /></span>
          </div>
        )}

        {/* Position 52 sem */}
        {pos != null && (
          <div className="min-w-[180px] flex-1">
            <div className="flex items-center justify-between text-[11px] text-faint mb-1">
              <span className="tabular">{fmtNumber(low52)}</span>
              <span>Plage observée sur 2 ans</span>
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
