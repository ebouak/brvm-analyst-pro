import type { TechnicalSummaryResult, SignalDirection } from '@/lib/technicalSummary';

function dirIcon(dir: SignalDirection): string {
  switch (dir) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'neutral': return '→';
    case 'na': return '·';
  }
}

function dirClass(dir: SignalDirection): string {
  switch (dir) {
    case 'up': return 'text-up';
    case 'down': return 'text-down';
    case 'neutral': return 'text-muted';
    case 'na': return 'text-faint';
  }
}

function trendColor(trend: TechnicalSummaryResult['trend']): string {
  switch (trend) {
    case 'hausse': return 'bg-up';
    case 'baisse': return 'bg-down';
    case 'neutre': return 'bg-faint';
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
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-xs text-muted uppercase tracking-widest mb-4">Analyse technique</p>

      {/* Grille de signaux */}
      <div className="grid grid-cols-1 gap-0 mb-4">
        {signals.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
            <span className={`font-mono text-sm font-bold w-4 text-center shrink-0 ${dirClass(s.direction)}`}>
              {dirIcon(s.direction)}
            </span>
            <span className={`text-xs flex-1 ${s.direction === 'na' ? 'text-faint italic' : 'text-white/80'}`}>
              {s.detail}
            </span>
          </div>
        ))}
      </div>

      {/* Tendance + barre */}
      <div className="border-t border-border/30 pt-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Tendance court terme</span>
          <span className={`text-xs font-semibold font-mono ${trendTextClass(trend)}`}>
            {dirIcon(trend === 'hausse' ? 'up' : trend === 'baisse' ? 'down' : 'neutral')}{' '}
            {trend.charAt(0).toUpperCase() + trend.slice(1)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${trendColor(trend)}`}
              style={{ width: `${confidence}%` }} /* dynamic — inline style required */
            />
          </div>
          <span className="text-xs text-muted font-mono tabular w-8 text-right">{confidence}%</span>
        </div>

        <div className="flex gap-4 text-[11px]">
          <span className="text-up font-mono">{bullCount} ↑ haussier{bullCount !== 1 ? 's' : ''}</span>
          <span className="text-down font-mono">{bearCount} ↓ baissier{bearCount !== 1 ? 's' : ''}</span>
          <span className="text-faint font-mono">{result.neutCount} → neutre{result.neutCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
