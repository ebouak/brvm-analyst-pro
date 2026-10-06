'use client';

import type { SignalDaily } from '@/lib/types';
import { useBeginnerMode } from '@/lib/beginner-mode';

const STYLES: Record<string, string> = {
  BUY: 'bg-up/15 text-up border-up/30',
  SELL: 'bg-down/15 text-down border-down/30',
  HOLD: 'bg-muted/10 text-muted border-border',
};

const SIGNAL_HINTS: Record<string, string> = {
  BUY: "Signal d'achat : le score technique dépasse le seuil d'achat. Lecture des cours passés, ni prévision ni conseil.",
  HOLD: "Aucun signal : le score technique reste entre les seuils d'achat et de vente.",
  SELL: "Signal de vente : le score technique passe sous le seuil de vente. Lecture des cours passés, ni prévision ni conseil.",
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
  const { beginner } = useBeginnerMode();

  if (!signal) return <span className="text-muted text-xs">—</span>;
  return (
    <div>
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
      {beginner && signal in SIGNAL_HINTS && (
        <span className="block text-[10px] text-faint mt-0.5 leading-snug">
          {SIGNAL_HINTS[signal]}
        </span>
      )}
    </div>
  );
}
