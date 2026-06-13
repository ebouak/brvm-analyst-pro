import type { TechnicalReading } from '@/lib/signal/technical';
import type { PositionContext } from '@/lib/signal/position';
import type { DividendTiming } from '@/lib/signal/dividendTiming';
import type { Synthesis } from '@/lib/signal/synthesis';

interface Props {
  signal: 'BUY' | 'HOLD' | 'SELL';
  synthesis: Synthesis;
  technical: TechnicalReading;
  position: PositionContext;
  dividend: DividendTiming;
}

const TONE_RING: Record<TechnicalReading['tone'], string> = {
  bullish: 'border-up/30',
  bearish: 'border-down/30',
  mixed: 'border-warn/30',
  neutral: 'border-border',
};

/**
 * Analyse synthétique du signal : verdict nuancé réconciliant lecture technique,
 * contexte de position (PRU) et timing dividende. Remplace l'ancien « SELL/BUY » sec.
 */
export default function SignalAnalysis({ synthesis, technical, position, dividend }: Props) {
  return (
    <div className="space-y-4">
      {/* Verdict de synthèse */}
      <div className={`rounded-card border bg-elevated/40 p-4 ${TONE_RING[technical.tone]}`}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold/70 mb-1.5">Analyse de synthèse</p>
        <p className="text-sm text-ivory leading-relaxed">{synthesis.verdict}</p>

        {synthesis.cautions.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {synthesis.cautions.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-warn/90">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lecture technique */}
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] uppercase tracking-wider text-faint">Lecture technique</p>
          <span className="text-xs font-semibold text-ivory">{technical.headline}</span>
        </div>
        <ul className="space-y-1.5">
          {technical.points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-faint" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {technical.tension && (
          <p className="mt-3 rounded-md border-l-2 border-warn/50 bg-warn/[0.06] px-3 py-2 text-xs text-warn/90 leading-relaxed">
            {technical.tension}
          </p>
        )}
      </div>

      {/* Deux colonnes : Position | Dividende */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Position */}
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-faint mb-2">Votre position</p>
          {position.held ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted">Plus-value latente</span>
                <span className={`tabular text-sm font-semibold ${(position.latentPnlPct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                  {position.latentPnlPct != null ? `${position.latentPnlPct >= 0 ? '+' : ''}${position.latentPnlPct.toFixed(1)}%` : '—'}
                </span>
              </div>
              {position.pru != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">PRU</span>
                  <span className="tabular text-xs text-ivory">{position.pru.toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted leading-relaxed">{position.reading}</p>
        </div>

        {/* Dividende */}
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-faint mb-2">Dividende</p>
          {dividend.status === 'none' ? (
            <p className="text-xs text-faint">Aucune information dividende disponible.</p>
          ) : (
            <div className="space-y-1.5">
              {dividend.yieldPct != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">Rendement</span>
                  <span className="tabular text-sm font-semibold text-gold">{dividend.yieldPct.toFixed(1)}%</span>
                </div>
              )}
              {dividend.daysToEx != null && dividend.daysToEx >= 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">Détachement</span>
                  <span className="tabular text-xs text-ivory">
                    {dividend.daysToEx === 0 ? "aujourd'hui" : `J-${dividend.daysToEx}`}
                  </span>
                </div>
              )}
              <p className="mt-1 text-xs text-muted leading-relaxed">{dividend.verdict}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
