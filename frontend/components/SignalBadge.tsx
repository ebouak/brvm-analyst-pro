'use client';

import { libelleSignal } from '@/lib/signalLabel';
import type { SignalDaily } from '@/lib/types';
import { useBeginnerMode } from '@/lib/beginner-mode';

const STYLES: Record<string, string> = {
  BUY: 'bg-up/15 text-up border-up/30',
  SELL: 'bg-down/15 text-down border-down/30',
  HOLD: 'bg-muted/10 text-muted border-border',
};

const SIGNAL_HINTS: Record<string, string> = {
  BUY: "Signal haussier : le score technique dépasse le seuil haut. Lecture des cours passés, ni prévision ni conseil.",
  HOLD: "Neutre : le score technique reste entre les deux seuils.",
  SELL: "Signal baissier : le score technique passe sous le seuil bas. Lecture des cours passés, ni prévision ni conseil.",
};

export default function SignalBadge({
  signal,
  confiance,
  small,
}: {
  signal: SignalDaily['signal'] | null | undefined;
  confiance?: number | null;
  small?: boolean;
  /** Sans effet : le libellé est toujours français (haussier / neutre / baissier). */
  francais?: boolean;
}) {
  const { beginner } = useBeginnerMode();

  if (!signal) return <span className="text-muted text-xs">—</span>;
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1 border rounded px-1.5 py-0.5 ${
          small ? 'text-[11px]' : 'text-xs'
        } ${STYLES[signal]}`}
      >
        {libelleSignal(signal)}
        {confiance != null && (
          <span className="text-muted tabular">{Math.round(confiance * 100)}%</span>
        )}
      </span>
      {beginner && signal in SIGNAL_HINTS && (
        <span className="block text-[11px] text-faint mt-0.5 leading-snug">
          {SIGNAL_HINTS[signal]}
        </span>
      )}
    </div>
  );
}
