import type { BetaResult } from './types';

/** Nombre minimal d'observations pour qu'une régression de bêta soit publiable. */
export const MIN_BETA_OBS = 12;

/**
 * Convertit une série de prix en rendements simples période à période.
 * Ignore les couples non finis ou à prix précédent ≤ 0 (pas de rendement défini).
 */
export function toReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p0 = prices[i - 1];
    const p1 = prices[i];
    if (!Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0) continue;
    out.push(p1 / p0 - 1);
  }
  return out;
}

/**
 * Bêta = pente de la régression OLS des rendements du titre sur ceux du marché
 * (β = cov(titre, marché) / var(marché)). R² = carré de la corrélation.
 *
 * N'INVENTE RIEN : si les données sont insuffisantes (< MIN_BETA_OBS) ou si la
 * variance de marché est nulle, retourne `beta: null` (le caller décidera d'un
 * éventuel repli sectoriel, clairement étiqueté « estimé »).
 *
 * Les deux séries doivent être alignées (même longueur). Sinon on tronque à la
 * plus courte — mais c'est au caller d'aligner les dates en amont.
 */
export function computeBeta(stockReturns: number[], marketReturns: number[]): BetaResult {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < MIN_BETA_OBS) return { beta: null, r2: null, nObs: n };

  let sumS = 0;
  let sumM = 0;
  for (let i = 0; i < n; i++) {
    sumS += stockReturns[i];
    sumM += marketReturns[i];
  }
  const meanS = sumS / n;
  const meanM = sumM / n;

  let cov = 0;
  let varM = 0;
  let varS = 0;
  for (let i = 0; i < n; i++) {
    const ds = stockReturns[i] - meanS;
    const dm = marketReturns[i] - meanM;
    cov += ds * dm;
    varM += dm * dm;
    varS += ds * ds;
  }

  if (varM === 0) return { beta: null, r2: null, nObs: n };

  const beta = cov / varM;
  const r2 = varS === 0 ? 0 : (cov * cov) / (varM * varS);
  return { beta, r2, nObs: n };
}
