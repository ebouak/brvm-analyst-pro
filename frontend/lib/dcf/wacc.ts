import type { WaccInputs, WaccResult } from './types';

/**
 * Coût des fonds propres par le MEDAF augmenté du risque pays :
 *   Ke = rf + β·ERP + CRP
 */
export function costOfEquity(
  riskFree: number,
  beta: number,
  equityRiskPremium: number,
  countryRiskPremium: number,
): number {
  return riskFree + beta * equityRiskPremium + countryRiskPremium;
}

/**
 * WACC = (E/V)·Ke + (D/V)·Kd·(1−t).
 *
 * N'INVENTE RIEN :
 * - si la dette de marché est nulle (ou Kd inconnu), le WACC se réduit au coût
 *   des fonds propres (pas de branche dette fabriquée) ;
 * - les poids E/V et D/V dérivent strictement des valeurs fournies (réelles).
 */
export function computeWacc(inputs: WaccInputs): WaccResult {
  const {
    riskFree,
    beta,
    equityRiskPremium,
    countryRiskPremium,
    costOfDebtPreTax,
    taxRate,
    marketValueEquity,
    marketValueDebt,
  } = inputs;

  const ke = costOfEquity(riskFree, beta, equityRiskPremium, countryRiskPremium);

  const e = Math.max(0, marketValueEquity);
  const d = Math.max(0, marketValueDebt);
  const v = e + d;

  // Pas de dette financière exploitable → WACC = Ke (100 % fonds propres).
  if (d === 0 || costOfDebtPreTax == null || v === 0) {
    return {
      costOfEquity: ke,
      costOfDebtAfterTax: costOfDebtPreTax != null ? costOfDebtPreTax * (1 - taxRate) : null,
      weightEquity: 1,
      weightDebt: 0,
      wacc: ke,
    };
  }

  const kdAfterTax = costOfDebtPreTax * (1 - taxRate);
  const wE = e / v;
  const wD = d / v;
  const wacc = wE * ke + wD * kdAfterTax;

  return {
    costOfEquity: ke,
    costOfDebtAfterTax: kdAfterTax,
    weightEquity: wE,
    weightDebt: wD,
    wacc,
  };
}
