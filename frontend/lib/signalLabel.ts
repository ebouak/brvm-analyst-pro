/**
 * Libellé français d'un signal. Les valeurs internes (BUY / HOLD / SELL) ne
 * changent pas. Un signal décrit l'orientation des indicateurs, pas une
 * opération à passer : « Achat » / « Vente » se lisaient comme une
 * recommandation d'investissement (audit de conformité, lot B, 2026-11-11).
 */
const LIBELLES: Record<string, string> = { BUY: 'Signal haussier', HOLD: 'Neutre', SELL: 'Signal baissier' };

export function libelleSignal(signal: string | null | undefined): string {
  if (!signal) return '—';
  return LIBELLES[signal] ?? signal;
}

/** Sens d'un signal, en mots de la charte : haussier, neutre, baissier ; null si inconnu. */
export function sensSignal(signal: string | null | undefined): 'haussier' | 'neutre' | 'baissier' | null {
  if (!signal) return null;
  if (signal === 'HOLD') return 'neutre';
  if (signal === 'BUY') return 'haussier';
  if (signal === 'SELL') return 'baissier';
  return null;
}
