// Graphique avancé : formats d'affichage (français).

/** Espace ordinaire à la place des espaces fines insécables (polices PDF standard). */
const ESPACES = /[  ]/g;

export function fmtPrix(v: number | null | undefined, decimales = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('fr-FR', { maximumFractionDigits: decimales });
}

export function fmtEntier(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('fr-FR');
}

export function fmtPctSigne(v: number | null | undefined, decimales = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = v.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${v > 0 ? '+' : ''}${s} %`;
}

export function fmtEcartSigne(v: number, decimales = 2): string {
  return `${v > 0 ? '+' : ''}${fmtPrix(v, decimales)}`;
}

/** 2026-11-13 → 13/11/2026 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Variante sans espace insécable, pour les polices standard du PDF. */
export function sansInsecable(s: string): string {
  return s.replace(ESPACES, ' ');
}
