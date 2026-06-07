export function formatXOF(value: number | null | undefined): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Md FCFA`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M FCFA`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} K FCFA`;
  }
  return `${sign}${abs.toLocaleString('fr-FR')} FCFA`;
}

export function formatCours(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return 'non disponible';
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function formatRatio(value: number | null | undefined): string {
  if (value == null) return 'non disponible';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatGrowth(value: number | null | undefined): string {
  if (value == null) return 'non disponible';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function colorClass(
  value: number | null | undefined,
  opts?: { inverse?: boolean; threshold?: number }
): string {
  if (value == null) return 'text-gray-400';
  const threshold = opts?.threshold ?? 0;
  const isPositive = value > threshold;
  const isNegative = value < threshold;
  if (opts?.inverse) {
    if (isPositive) return 'text-red-400';
    if (isNegative) return 'text-green-400';
    return 'text-white';
  }
  if (isPositive) return 'text-green-400';
  if (isNegative) return 'text-red-400';
  return 'text-white';
}
