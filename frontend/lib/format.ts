export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtFcfa(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  // Pas de « T » (téra) : un lecteur francophone lit en milliards. 1,92e12 → « 1 920 Md ».
  // Au-delà de 1 000 Md : entier groupé (espace insécable fr-FR) ; en dessous, 2 décimales.
  if (Math.abs(n) >= 1e12) return fmtNumber(Math.round(n / 1e9), 0) + ' Md';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' Md';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
  // Sous le million : montant entier, jamais arrondi au millier (1 500 ≠ « 2 k »).
  return fmtNumber(Math.round(n), 0);
}

/** "2026-05-26" → "26/05/2026" */
export function fmtDateFR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const soloDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', ...(soloDate ? { timeZone: 'UTC' } : {}) });
}

/** Date courte « 6 nov. 2026 » (DESIGN.md) : listes, en-têtes, tableaux. Une date ISO seule (AAAA-MM-JJ) est lue en UTC. */
export function fmtDateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const soloDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', ...(soloDate ? { timeZone: 'UTC' } : {}) });
}

/** "2026-05-26" + "16:30" → "26/05/2026 16:30" */
export function fmtDateTimeFR(iso: string | null | undefined, time = '16:30'): string {
  return fmtDateFR(iso) === '—' ? '—' : `${fmtDateFR(iso)} ${time}`;
}

/**
 * Signe choisi APRÈS l'arrondi : jamais « +0,00 % » ni « −0,00 % ».
 * Le moins est typographique (U+2212), comme dans tout le site.
 */
function signeArrondi(v: number, d: number): '' | '+' | '−' {
  const r = Number(v.toFixed(d));
  return r > 0 ? '+' : r < 0 ? '−' : '';
}

/** « 0,26 % » — pour les phrases dont le verbe porte déjà le sens. */
export function fmtPctAbs(v: number, d = 2): string {
  return `${fmtNumber(Math.abs(v), d)} %`;
}

/** « +1,95 % », « −0,26 % », « 0,00 % ». */
export function fmtPctSigne(v: number, d = 2): string {
  if (!Number.isFinite(v)) return '—';
  return `${signeArrondi(v, d)}${fmtPctAbs(v, d)}`;
}

/** Montant FCFA signé : « +1,3 M », « −450 k ». Sans signe sous le franc. */
export function fmtFcfaSigne(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${signeArrondi(n, 0)}${fmtFcfa(Math.abs(n))}`;
}
