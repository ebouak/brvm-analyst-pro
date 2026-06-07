'use client';
import type { TechnicalSummaryResult, SignalDirection } from '@/lib/technicalSummary';

function dirIcon(dir: SignalDirection): string {
  switch (dir) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'neutral': return '→';
    case 'na': return '○';
  }
}

function dirClass(dir: SignalDirection): string {
  switch (dir) {
    case 'up': return 'text-up';
    case 'down': return 'text-down';
    case 'neutral': return 'text-muted';
    case 'na': return 'text-muted opacity-50';
  }
}

function trendColor(trend: TechnicalSummaryResult['trend']): string {
  switch (trend) {
    case 'hausse': return 'bg-up';
    case 'baisse': return 'bg-down';
    case 'neutre': return 'bg-muted';
  }
}

function trendTextClass(trend: TechnicalSummaryResult['trend']): string {
  switch (trend) {
    case 'hausse': return 'text-up';
    case 'baisse': return 'text-down';
    case 'neutre': return 'text-muted';
  }
}

export default function TechnicalSummary({ result }: { result: TechnicalSummaryResult }) {
  const { signals, trend, confidence, bullCount, bearCount } = result;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold">⚙️ Configuration technique</h3>

      {/* Signaux */}
      <div className="space-y-1.5">
        {signals.map((s) => (
          <div key={s.id} className="flex items-start gap-2">
            <span className={`text-sm font-bold leading-5 shrink-0 w-4 text-center ${dirClass(s.direction)}`}>
              {dirIcon(s.direction)}
            </span>
            <span className={`text-xs leading-5 ${s.direction === 'na' ? 'text-muted opacity-60 italic' : 'text-white/80'}`}>
              {s.detail}
            </span>
          </div>
        ))}
      </div>

      {/* Tendance + barre de confiance */}
      <div className="border-t border-border/50 pt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Tendance court terme :</span>
          <span className={`text-xs font-bold ${trendTextClass(trend)}`}>
            {dirIcon(trend === 'hausse' ? 'up' : trend === 'baisse' ? 'down' : 'neutral')}{' '}
            {trend.charAt(0).toUpperCase() + trend.slice(1)}
          </span>
        </div>

        {/* Barre de confiance */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${trendColor(trend)}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs text-muted tabular w-8 text-right">{confidence}%</span>
        </div>

        {/* Compteurs */}
        <div className="flex gap-3 text-xs">
          <span className="text-up">↑ {bullCount} haussier{bullCount !== 1 ? 's' : ''}</span>
          <span className="text-down">↓ {bearCount} baissier{bearCount !== 1 ? 's' : ''}</span>
          <span className="text-muted">→ {result.neutCount} neutre{result.neutCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
