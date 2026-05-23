/**
 * Utilitaires de dates pour le marché BRVM (fuseau Africa/Abidjan, UTC+0).
 */
import type { MarketDate } from '../types.js';

/** Date de marché du jour au format YYYY-MM-DD (fuseau Abidjan = UTC). */
export function todayMarketDate(): MarketDate {
  // Abidjan est à UTC+0 toute l'année (pas de DST), donc UTC convient.
  return new Date().toISOString().slice(0, 10);
}

/** Valide qu'une chaîne est bien une date ISO YYYY-MM-DD plausible. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

/**
 * Parse une date au format francophone (jj/mm/aaaa, jj-mm-aaaa) ou ISO
 * et renvoie YYYY-MM-DD, ou null si non reconnue.
 */
export function parseFrDate(raw: string | null | undefined): MarketDate | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === '' || s === '-') return null;

  // Déjà ISO ?
  if (isIsoDate(s)) return s;

  // jj/mm/aaaa ou jj-mm-aaaa
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const day = m[1]!.padStart(2, '0');
    const month = m[2]!.padStart(2, '0');
    let year = m[3]!;
    if (year.length === 2) year = '20' + year;
    const iso = `${year}-${month}-${day}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}
