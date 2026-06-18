/**
 * Types du module Valorisation DCF (WACC/MEDAF).
 * Logique 100 % pure et testable, isolée des I/O — additif, n'altère pas
 * `lib/financials/valuation.ts` (dcfSimple) ni `/premium/valorisation`.
 */

export interface BetaResult {
  /** Bêta (pente de régression des rendements titre vs marché). null si non calculable. */
  beta: number | null;
  /** Coefficient de détermination R² (qualité de l'ajustement). */
  r2: number | null;
  /** Nombre d'observations utilisées. */
  nObs: number;
}

export interface WaccInputs {
  riskFree: number; // rf — taux sans risque (décimal, ex. 0.06)
  beta: number; // β levered
  equityRiskPremium: number; // ERP (décimal)
  countryRiskPremium: number; // CRP (décimal)
  costOfDebtPreTax: number | null; // Kd avant impôt (décimal) — null si dette nulle/inconnue
  taxRate: number; // t (décimal, ex. 0.25)
  marketValueEquity: number; // E (valeur de marché des fonds propres)
  marketValueDebt: number; // D (dette financière)
}

export interface WaccResult {
  costOfEquity: number; // Ke = rf + β·ERP + CRP
  costOfDebtAfterTax: number | null; // Kd·(1−t)
  weightEquity: number; // E/V
  weightDebt: number; // D/V
  wacc: number;
}

export type DcfError = 'wacc_le_terminal' | 'fcf_non_positif' | 'shares_invalide';

export interface DcfInputs {
  baseFcf: number; // dernier FCF normalisé (devise, niveau société)
  growthRate: number; // g sur l'horizon explicite (décimal)
  years: number; // horizon explicite (ex. 5)
  terminalGrowth: number; // g∞ (décimal)
  wacc: number; // taux d'actualisation (décimal)
  netDebt: number; // dette nette (EV → equity)
  shares: number; // nombre d'actions
}

export interface DcfResult {
  projectedFcf: number[]; // FCF projetés années 1..N
  discountedFcf: number[]; // FCF actualisés
  terminalValue: number; // VT à l'année N (non actualisée)
  pvTerminal: number; // VT actualisée
  enterpriseValue: number; // EV = Σ FCF actualisés + VT actualisée
  equityValue: number; // EV − dette nette
  fairValuePerShare: number | null; // equity / actions
  error?: DcfError;
}
