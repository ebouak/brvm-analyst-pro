import { computeBeta, toReturns } from './beta';
import { computeWacc } from './wacc';
import { computeDcf, sensitivityMatrix } from './dcf';
import type { BetaResult, WaccResult, DcfResult } from './types';

/**
 * Orchestrateur PUR du module DCF : à partir de données brutes réelles
 * (déjà chargées par la couche serveur) + des hypothèses ajustables, dérive
 * tous les intrants (FCF base, dette nette, Kd, valeurs de marché) puis combine
 * bêta + WACC + DCF + sensibilité.
 *
 * N'INVENTE RIEN : chaque intrant non dérivable des données reste `null` et le
 * champ `notes` explique pourquoi ; les hypothèses (croissance, horizon, rf de
 * repli, ERP, β estimé) sont passées explicitement par le caller.
 */

export interface AssembleRawInputs {
  /** Cours actuel (FCFA). */
  cours: number | null;
  /** Nombre d'actions en circulation. */
  shares: number | null;
  /** Historique de FCF annuels, du plus ANCIEN au plus RÉCENT (déjà dérivés/réels). */
  fcfHistory: number[];
  /** Dette financière (LT + CT). */
  totalDebt: number | null;
  /** Trésorerie & équivalents (pour la dette nette). */
  cash: number | null;
  /** Charges financières nettes (pour Kd = charges / dette). */
  interestExpense: number | null;
  /** Rendements alignés titre / marché pour le bêta (déjà calculés ou via prix). */
  stockPrices?: number[];
  marketPrices?: number[];
  /** Prime de risque pays (réelle, table Damodaran). */
  equityRiskPremium: number;
  countryRiskPremium: number;
  taxRate: number;
}

export interface AssembleAssumptions {
  /** Taux sans risque (réel depuis la courbe, ou saisi). */
  riskFree: number;
  /** Croissance des FCF sur l'horizon explicite (hypothèse). */
  growthRate: number;
  years: number;
  terminalGrowth: number;
  /** Bêta de repli si la régression n'est pas calculable (étiqueté « estimé »). */
  fallbackBeta: number;
  /** Bêta forcé par l'utilisateur (prioritaire sur la régression et le repli). */
  betaOverride?: number;
}

export interface DcfComputation {
  beta: BetaResult;
  /** Bêta réellement utilisé dans le WACC (régressé ou repli). */
  betaUsed: number;
  betaEstimated: boolean;
  wacc: WaccResult;
  marketValueEquity: number | null;
  netDebt: number | null;
  costOfDebtPreTax: number | null;
  baseFcf: number | null;
  dcf: DcfResult | null;
  upside: number | null; // (fairValue − cours) / cours
  sensitivity: (number | null)[][];
  notes: string[];
}

/** Dette nette = dette financière − trésorerie (≥ peut être négative = trésorerie nette). */
export function netDebtOf(totalDebt: number | null, cash: number | null): number | null {
  if (totalDebt == null && cash == null) return null;
  return (totalDebt ?? 0) - (cash ?? 0);
}

/**
 * Coût de la dette avant impôt = charges financières / dette financière.
 * null si non dérivable — y compris quand les charges sont ≤ 0 (c'est alors un
 * PRODUIT financier net, pas un coût : on n'en fabrique pas un Kd négatif).
 */
export function costOfDebtOf(interestExpense: number | null, totalDebt: number | null): number | null {
  if (interestExpense == null || interestExpense <= 0 || totalDebt == null || totalDebt <= 0) return null;
  return interestExpense / totalDebt;
}

export function assembleDcf(raw: AssembleRawInputs, a: AssembleAssumptions): DcfComputation {
  const notes: string[] = [];

  // — Bêta (réel si possible, sinon repli étiqueté) —
  const beta =
    raw.stockPrices && raw.marketPrices
      ? computeBeta(toReturns(raw.stockPrices), toReturns(raw.marketPrices))
      : ({ beta: null, r2: null, nObs: 0 } as BetaResult);
  const regressed = beta.beta;
  const betaUsed = a.betaOverride ?? regressed ?? a.fallbackBeta;
  const betaEstimated = a.betaOverride == null && regressed == null;
  if (a.betaOverride != null) notes.push('Bêta saisi manuellement (hypothèse).');
  else if (betaEstimated) notes.push('Bêta estimé (historique insuffisant) — valeur sectorielle de repli.');

  // — Valeurs dérivées (réelles) —
  const marketValueEquity =
    raw.cours != null && raw.shares != null && raw.shares > 0 ? raw.cours * raw.shares : null;
  const netDebt = netDebtOf(raw.totalDebt, raw.cash);
  const costOfDebtPreTax = costOfDebtOf(raw.interestExpense, raw.totalDebt);
  if (costOfDebtPreTax == null) notes.push('Coût de la dette non dérivable → WACC = coût des fonds propres.');

  // — WACC —
  const wacc = computeWacc({
    riskFree: a.riskFree,
    beta: betaUsed,
    equityRiskPremium: raw.equityRiskPremium,
    countryRiskPremium: raw.countryRiskPremium,
    costOfDebtPreTax,
    taxRate: raw.taxRate,
    marketValueEquity: marketValueEquity ?? 0,
    marketValueDebt: raw.totalDebt ?? 0,
  });

  // — FCF de base (dernier réel) —
  const baseFcf = raw.fcfHistory.length > 0 ? raw.fcfHistory[raw.fcfHistory.length - 1] : null;
  if (baseFcf == null) notes.push('Aucun flux de trésorerie disponible en base → DCF non calculable.');

  // — DCF —
  let dcf: DcfResult | null = null;
  let sensitivity: (number | null)[][] = [];
  let upside: number | null = null;

  if (baseFcf != null && raw.shares != null && raw.shares > 0) {
    const dcfInputs = {
      baseFcf,
      growthRate: a.growthRate,
      years: a.years,
      terminalGrowth: a.terminalGrowth,
      wacc: wacc.wacc,
      netDebt: netDebt ?? 0,
      shares: raw.shares,
    };
    dcf = computeDcf(dcfInputs);
    sensitivity = sensitivityMatrix(dcfInputs, [-0.01, 0, 0.01], [-0.005, 0, 0.005]);
    if (dcf.fairValuePerShare != null && raw.cours != null && raw.cours > 0) {
      upside = (dcf.fairValuePerShare - raw.cours) / raw.cours;
    }
  }

  return {
    beta,
    betaUsed,
    betaEstimated,
    wacc,
    marketValueEquity,
    netDebt,
    costOfDebtPreTax,
    baseFcf,
    dcf,
    upside,
    sensitivity,
    notes,
  };
}

/** CAGR d'une série de FCF (du plus ancien au plus récent). null si non calculable (signe/0). */
export function fcfCagr(fcfHistory: number[]): number | null {
  if (fcfHistory.length < 2) return null;
  const first = fcfHistory[0];
  const last = fcfHistory[fcfHistory.length - 1];
  if (first <= 0 || last <= 0) return null; // CAGR non défini si signe change ou ≤ 0
  const periods = fcfHistory.length - 1;
  return Math.pow(last / first, 1 / periods) - 1;
}
