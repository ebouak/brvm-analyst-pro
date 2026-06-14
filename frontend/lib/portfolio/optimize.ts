/**
 * Optimiseur de portefeuille (Markowitz) — fonctions pures et testables.
 *
 * À partir des rendements historiques des positions détenues, calcule :
 *  - rendement/volatilité du portefeuille pour des poids donnés ;
 *  - portefeuille min-variance (closed-form Σ⁻¹1 / 1ᵀΣ⁻¹1) ;
 *  - portefeuille tangent max-Sharpe (Σ⁻¹(μ−rf), normalisé) ;
 *  - contribution de chaque position au risque total ;
 *  - écarts de rééquilibrage (poids actuels → poids cibles).
 *
 * Implémentation matricielle simple (N petit : quelques positions).
 */

export interface AssetSeries {
  code: string;
  returns: number[]; // rendements périodiques alignés (même longueur)
}

export interface OptimizeResult {
  codes: string[];
  meanReturns: number[];     // annualisés
  volatilities: number[];    // annualisées
  minVarianceWeights: number[] | null;
  maxSharpeWeights: number[] | null;
  riskContributions: number[]; // pour les poids actuels [0..1]
  portfolio: { ret: number; vol: number; sharpe: number | null }; // poids actuels
}

const PERIODS_PER_YEAR = 252; // rendements quotidiens (séances BRVM/an)

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

/** Matrice de covariance (échantillon) des séries de rendements. */
export function covariance(series: number[][]): number[][] {
  const n = series.length;
  const m = series[0]?.length ?? 0;
  const means = series.map(mean);
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += (series[i]![k]! - means[i]!) * (series[j]![k]! - means[j]!);
      const v = m > 1 ? s / (m - 1) : 0;
      cov[i]![j] = v; cov[j]![i] = v;
    }
  }
  return cov;
}

/** Inversion par Gauss-Jordan ; null si singulière. */
export function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const pv = a[col]![col]!;
    for (let j = 0; j < 2 * n; j++) a[col]![j]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]!;
      for (let j = 0; j < 2 * n; j++) a[r]![j]! -= f * a[col]![j]!;
    }
  }
  return a.map((row) => row.slice(n));
}

function matVec(m: number[][], v: number[]): number[] {
  return m.map((row) => row.reduce((s, x, j) => s + x * v[j]!, 0));
}
function normalizeToOne(w: number[]): number[] {
  const sum = w.reduce((a, b) => a + b, 0);
  return sum !== 0 ? w.map((x) => x / sum) : w.map(() => 1 / w.length);
}

export function portfolioStats(weights: number[], means: number[], cov: number[][], rf: number) {
  const ret = weights.reduce((s, w, i) => s + w * means[i]!, 0);
  const variance = weights.reduce((s, wi, i) => s + wi * cov[i]!.reduce((ss, cij, j) => ss + cij * weights[j]!, 0), 0);
  const vol = Math.sqrt(Math.max(0, variance));
  const sharpe = vol > 0 ? (ret - rf) / vol : null;
  return { ret, vol, sharpe };
}

export function optimize(assets: AssetSeries[], currentWeights: number[], riskFreeRate = 0.06): OptimizeResult {
  const codes = assets.map((a) => a.code);
  const n = assets.length;
  const series = assets.map((a) => a.returns);

  // Annualisation des rendements/vol.
  const meanReturns = series.map((r) => mean(r) * PERIODS_PER_YEAR);
  const covP = covariance(series);
  const cov = covP.map((row) => row.map((v) => v * PERIODS_PER_YEAR));
  const volatilities = cov.map((row, i) => Math.sqrt(Math.max(0, row[i]!)));

  const inv = n >= 1 ? invert(cov) : null;
  const ones = new Array(n).fill(1);

  let minVarianceWeights: number[] | null = null;
  let maxSharpeWeights: number[] | null = null;
  if (inv) {
    const z = matVec(inv, ones);
    const denom = z.reduce((a, b) => a + b, 0);
    if (Math.abs(denom) > 1e-12) minVarianceWeights = z.map((x) => x / denom);
    const excess = meanReturns.map((m) => m - riskFreeRate);
    const y = matVec(inv, excess);
    const sumY = y.reduce((a, b) => a + b, 0);
    if (Math.abs(sumY) > 1e-12) maxSharpeWeights = y.map((x) => x / sumY);
  }

  // Contribution au risque (poids actuels) : w_i * (Σw)_i / variance.
  const w = currentWeights.length === n ? normalizeToOne(currentWeights) : new Array(n).fill(1 / n);
  const sigmaW = matVec(cov, w);
  const variance = w.reduce((s, wi, i) => s + wi * sigmaW[i]!, 0);
  const riskContributions = w.map((wi, i) => (variance > 0 ? (wi * sigmaW[i]!) / variance : 1 / n));

  return {
    codes,
    meanReturns,
    volatilities,
    minVarianceWeights,
    maxSharpeWeights,
    riskContributions,
    portfolio: portfolioStats(w, meanReturns, cov, riskFreeRate),
  };
}
