// Formatage des nombres au format francophone/financier.
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
