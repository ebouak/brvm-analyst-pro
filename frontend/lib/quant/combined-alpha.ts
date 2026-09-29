import { clamp } from './math';
import { CA_WEIGHTS, GLOBAL_RISK_CAP, classifyCombinedAlpha } from './constants';
import type { Penalty, ConfidenceLevel } from './types';

export interface PillarScores {
  value: number | null;
  momentum: number | null;
  earningsQuality: number | null;
  financialStrength: number | null;
  dividendQuality: number | null;
}

export function computeCombinedAlpha(
  pillars: PillarScores,
  opts: {
    globalRiskPenaltyInput?: number;
    confidence: ConfidenceLevel;
    notes?: string[];
  }
): { score: number | null; classification: import('./types').QuantClassification; penalty: number; notes: string[]; redistribution: boolean } {
  const notes = [...(opts.notes ?? [])];
  const available = (Object.entries(pillars) as [keyof PillarScores, number | null][]).filter(([, v]) => v != null);
  // Require momentum + at least 3 of 4 others
  const hasMomentum = pillars.momentum != null;
  const otherCount = (['value','earningsQuality','financialStrength','dividendQuality'] as const).filter((k)=>pillars[k]!=null).length;
  if (!hasMomentum) return { score: null, classification: 'Insufficient Data', penalty: 0, notes: [...notes,'Momentum indisponible'], redistribution: false };
  if (otherCount < 3) return { score: null, classification: 'Insufficient Data', penalty: 0, notes: [...notes,`Seulement ${otherCount}/4 piliers disponibles`], redistribution: false };
  if (available.length <= 2) return { score: null, classification: 'Insufficient Data', penalty: 0, notes: [...notes,'>2 piliers manquants'], redistribution: false };

  // Redistribute weights proportionally
  const weights: Record<keyof PillarScores, number> = {
    value: CA_WEIGHTS.value,
    momentum: CA_WEIGHTS.momentum,
    earningsQuality: CA_WEIGHTS.earningsQuality,
    financialStrength: CA_WEIGHTS.financialStrength,
    dividendQuality: CA_WEIGHTS.dividendQuality,
  };
  const wAvail = available.reduce((s,[k])=>s+weights[k],0);
  const redistribution = wAvail < 0.999;
  if (redistribution) notes.push('Poids redistribués proportionnellement (pilier manquant)');
  let raw = 0;
  for (const [k,v] of available) raw += (v as number) * (weights[k]/wAvail);
  const penalty = clamp(opts.globalRiskPenaltyInput ?? 0, 0, GLOBAL_RISK_CAP);
  let score = clamp(Math.round(raw - penalty),0,100);
  const classification = classifyCombinedAlpha(score, opts.confidence);
  return { score, classification, penalty, notes, redistribution };
}

export function computeGlobalRiskPenalty(flags: {
  negativeEquity?: boolean;
  consecutiveLosses?: number;
  missingRecentFinancials?: boolean;
  veryIlliquid?: boolean;
  uncertainCriticalData?: number; // 5-15
  unsustainableDividend?: boolean;
  isolatedPriceJump?: number; // 5-15
  excessiveDebt?: number; // 5-20
}): number {
  let p=0;
  if(flags.negativeEquity) p+=25;
  if((flags.consecutiveLosses??0)>=2) p+=20;
  if(flags.missingRecentFinancials) p+=15;
  if(flags.veryIlliquid) p+=10;
  if(flags.uncertainCriticalData) p+= clamp(flags.uncertainCriticalData,5,15);
  if(flags.unsustainableDividend) p+=10;
  if(flags.isolatedPriceJump) p+= clamp(flags.isolatedPriceJump,5,15);
  if(flags.excessiveDebt) p+= clamp(flags.excessiveDebt,5,20);
  return clamp(p,0,GLOBAL_RISK_CAP);
}
export function confidenceFromCoverage(coverageRate: number, hasRecentFinancials: boolean, liquidityScore: number | null): ConfidenceLevel {
  if (coverageRate < 0.5 || !hasRecentFinancials) return 'low';
  if (coverageRate < 0.75 || (liquidityScore!=null && liquidityScore<50)) return 'medium';
  if (coverageRate >= 0.85) return 'high';
  return 'medium';
}
