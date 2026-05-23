/**
 * Extraction du montant de dividende depuis un texte de communiqué.
 * Cherche un motant FCFA proche du mot "dividende" / "coupon".
 * Renvoie null si rien d'exploitable (on ne devine pas).
 */
import { parseFrNumber } from '../utils/parseNumber.js';

export function extractDividendAmount(text: string): number | null {
  const t = text.toLowerCase();
  if (!/(dividende|coupon)/.test(t)) return null;
  // Cherche un nombre suivi (ou précédé) de FCFA/XOF, ou "X par action".
  const patterns = [
    /([\d  .,]+)\s*(?:fcfa|xof|f\b)/i,
    /([\d  .,]+)\s*par\s+action/i,
    /dividende[^\d]*([\d  .,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseFrNumber(m[1]);
      if (n != null && n > 0) return n;
    }
  }
  return null;
}

/** Déduit l'année d'exercice depuis le texte (ex "exercice 2025", "dividende 2025"). */
export function extractExercice(text: string, fallbackYear: number): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  if (m) return Number(m[1]);
  return fallbackYear;
}
