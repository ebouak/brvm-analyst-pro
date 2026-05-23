/**
 * Normalisation des nombres au format francophone BRVM.
 * Exemples rencontrés sur BDFIN :
 *   "12 345,67"  -> 12345.67   (espace = séparateur de milliers, virgule décimale)
 *   "1 234"      -> 1234
 *   "-2,50%"     -> -2.5
 *   "+3,1 %"     -> 3.1
 *   "—" / "-" / "" / "N/A" -> null
 */

const NULLISH = new Set(['', '-', '—', '–', 'n/a', 'na', 'nd', 'n.d.']);

export function parseFrNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (NULLISH.has(s.toLowerCase())) return null;

  // Retirer symboles non numériques courants : %, FCFA, espaces (y compris insécables).
  s = s
    .replace(/ /g, ' ') // espace insécable -> espace normal
    .replace(/%/g, '')
    .replace(/fcfa/gi, '')
    .replace(/xof/gi, '')
    .trim();

  // Signe
  const negative = /^-/.test(s) || /\(.*\)/.test(s); // parenthèses = négatif comptable
  s = s.replace(/[()+\-]/g, '').trim();

  // Supprimer espaces (séparateurs de milliers), puis virgule -> point.
  s = s.replace(/\s/g, '').replace(/\./g, (m, offset, full: string) => {
    // Cas ambigu: si la chaîne contient une virgule, le point est un séparateur
    // de milliers et doit être supprimé. Sinon on le garde comme décimal.
    return full.includes(',') ? '' : '.';
  });
  s = s.replace(/,/g, '.');

  if (s === '' || Number.isNaN(Number(s))) return null;
  const n = Number(s);
  return negative ? -Math.abs(n) : n;
}

/** Variante entière (volumes, nb transactions). */
export function parseFrInt(raw: string | null | undefined): number | null {
  const n = parseFrNumber(raw);
  if (n == null) return null;
  return Math.round(n);
}

/** Nettoie un libellé: trim + espaces multiples réduits. */
export function cleanText(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}
