export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtFcfa(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' Md';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + ' k';
  return fmtNumber(n);
}

/** "2026-05-26" → "26/05/2026" */
export function fmtDateFR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "2026-05-26" + "16:30" → "26/05/2026 16:30" */
export function fmtDateTimeFR(iso: string | null | undefined, time = '16:30'): string {
  return fmtDateFR(iso) === '—' ? '—' : `${fmtDateFR(iso)} ${time}`;
}
