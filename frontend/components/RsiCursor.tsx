'use client';

/** Curseur de position RSI sur la barre — position dynamique nécessite un style inline. */
export default function RsiCursor({ rsi }: { rsi: number }) {
  const color = rsi < 30 ? 'bg-up' : rsi > 70 ? 'bg-down' : 'bg-white';
  const pct = Math.min(100, Math.max(0, rsi));
  return (
    <div
      className={`absolute top-0 bottom-0 w-2 rounded-full ${color}`}
      style={{ left: `calc(${pct}% - 4px)` }}
    />
  );
}
