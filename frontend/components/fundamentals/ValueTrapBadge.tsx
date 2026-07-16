import type { ValueTrapResult } from '@/lib/fundamentals/valueTrap';

/**
 * Badge d'alerte « value trap » : n'apparaît que lorsqu'il dit quelque chose
 * d'actionnable (piège, décote réelle, perte, ou titre cher). Silencieux quand
 * la valorisation est saine ou indéterminée — pas de bruit.
 */
const STYLE: Record<ValueTrapResult['severity'], { box: string; icon: string }> = {
  danger: { box: 'border-down/40 bg-down/10 text-down', icon: '⚠️' },
  warn: { box: 'border-warn/40 bg-warn/10 text-warn', icon: '⚡' },
  good: { box: 'border-up/40 bg-up/10 text-up', icon: '✓' },
  neutral: { box: 'border-border bg-surface text-muted', icon: 'ℹ️' },
};

export default function ValueTrapBadge({ result }: { result: ValueTrapResult }) {
  // On n'affiche rien pour « sain » et « indéterminé » : le silence est un signal.
  if (result.verdict === 'sain' || result.verdict === 'indetermine') return null;

  const s = STYLE[result.severity];
  return (
    <div className={`rounded-xl border px-4 py-3 ${s.box}`} role="note">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-base leading-none">{s.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{result.label}</p>
          <p className="mt-0.5 text-xs opacity-90">{result.raison}</p>
        </div>
      </div>
    </div>
  );
}
