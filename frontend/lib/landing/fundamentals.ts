/**
 * Ratios fondamentaux dérivés de la table `fundamentals`.
 *
 * Fonction pure. Chaque ratio vaut `null` dès qu'un opérande manque ou que le
 * dénominateur est nul ou négatif : on n'affiche pas un ROE de 0 % parce que
 * les capitaux propres sont absents, et un ROE calculé sur des capitaux
 * propres négatifs n'a pas de sens économique (il ressortirait positif à tort
 * pour une société en perte).
 */

export interface FundamentalsRow {
  code: string;
  year: number;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt: number | null;
}

export interface FundamentalsRatios {
  /** Marge nette en %, ou null. */
  margeNettePct: number | null;
  /** Rentabilité des capitaux propres en %, ou null. */
  roePct: number | null;
  /** Dette rapportée aux capitaux propres (ratio, pas %), ou null. */
  gearing: number | null;
}

function ratio(num: number | null, den: number | null): number | null {
  if (num == null || den == null || !Number.isFinite(num) || !Number.isFinite(den)) return null;
  if (den <= 0) return null;
  return num / den;
}

export function computeRatios(row: FundamentalsRow): FundamentalsRatios {
  const marge = ratio(row.net_income, row.revenue);
  const roe = ratio(row.net_income, row.equity);
  const gearing = ratio(row.debt, row.equity);
  return {
    margeNettePct: marge == null ? null : marge * 100,
    roePct: roe == null ? null : roe * 100,
    gearing,
  };
}

/**
 * Retient l'exercice le plus récent réellement exploitable : celui qui porte
 * au moins un chiffre d'affaires ou un résultat net. Une ligne créée pour une
 * année sans aucun montant ne doit pas masquer un exercice antérieur complet.
 */
export function latestUsable(rows: FundamentalsRow[]): FundamentalsRow | null {
  const usable = rows.filter((r) => r.revenue != null || r.net_income != null);
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => (b.year > a.year ? b : a));
}
