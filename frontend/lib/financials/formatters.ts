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

/**
 * Formate une valeur d'état financier selon SON unité.
 * Corrige deux erreurs de présentation : un nombre d'actions n'est pas un
 * montant en FCFA, et un BPA de 1 250 FCFA ne doit pas s'écrire « 1,3 K FCFA ».
 */
export function formatStatementValue(
  value: number | null | undefined,
  format: 'xof' | 'pct' | 'count' | 'perShare' = 'xof',
): string {
  if (value == null) return '—';
  switch (format) {
    case 'pct':
      return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
    case 'count':
      return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    case 'perShare':
      return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} FCFA`;
    default:
      return formatXOF(value);
  }
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
