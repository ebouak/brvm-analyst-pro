import type { SignalDaily } from '@/lib/types';

const STYLES: Record<string, string> = {
  BUY: 'bg-up/15 text-up border-up/30',
  SELL: 'bg-down/15 text-down border-down/30',
  HOLD: 'bg-muted/10 text-muted border-border',
};

export default function SignalBadge({
  signal,
  confiance,
  small,
}: {
  signal: SignalDaily['signal'] | null | undefined;
  confiance?: number | null;
  small?: boolean;
}) {
  if (!signal) return <span className="text-muted text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded px-1.5 py-0.5 ${
        small ? 'text-[10px]' : 'text-xs'
      } ${STYLES[signal]}`}
    >
      {signal}
      {confiance != null && (
        <span className="opacity-70 tabular">{Math.round(confiance * 100)}%</span>
      )}
    </span>
  );
}
