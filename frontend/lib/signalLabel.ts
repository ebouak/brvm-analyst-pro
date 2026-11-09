/** Libellé français d'un signal. Les valeurs internes (BUY / HOLD / SELL) ne changent pas. */
const LIBELLES: Record<string, string> = { BUY: 'Achat', HOLD: 'Attente', SELL: 'Vente' };

export function libelleSignal(signal: string | null | undefined): string {
  if (!signal) return '—';
  return LIBELLES[signal] ?? signal;
}
