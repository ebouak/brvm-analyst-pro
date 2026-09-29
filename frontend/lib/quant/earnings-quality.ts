import { calculatePercentile } from './normalization';
import { clamp, isFiniteNumber } from './math';
import type { Sector, FactorScore } from './types';
export interface EQInputs {
  sector: Sector; roe: number | null; roa?: number | null; epsGrowth3y?: number | null;
  marginStability?: number | null; cashConversion?: number | null; accruals?: number | null;
  earningsStability?: number | null; netIncomeGrowth?: number | null; costOfRisk?: number | null;
  combinedRatio?: number | null; investmentReturn?: number | null;
  peers: Record<string, (number | null)[]>; sectorPeers?: Record<string, (number | null)[]>;
}
function pct(v: number | null, arr: (number | null)[] | undefined, hib: boolean): number | null { if (!arr) return null; return calculatePercentile(v, arr, hib); }
function useArr(inp: EQInputs, k: string): (number | null)[] | undefined {
  const sp = inp.sectorPeers?.[k];
  if (sp && sp.filter((x) => x != null && isFiniteNumber(x as number)).length >= 5) return sp;
  return inp.peers[k];
}
export function computeEarningsQualityScore(inp: EQInputs): { score: number | null; factors: Record<string, FactorScore>; notes: string[] } {
  const notes: string[] = []; const isBank = inp.sector==='banks'; const isIns = inp.sector==='insurance';
  let factors: Record<string, FactorScore> = {};
  if (isBank) {
    const roePct = pct(inp.roe, useArr(inp,'roe'), true);
    const roaPct = pct(inp.roa??null, useArr(inp,'roa'), true);
    const nigPct = pct(inp.netIncomeGrowth??null, useArr(inp,'netIncomeGrowth'), true);
    const corPct = pct(inp.costOfRisk??null, useArr(inp,'costOfRisk'), false);
    const stabPct = pct(inp.earningsStability??null, useArr(inp,'earningsStability'), true);
    const hasCor = corPct!=null; if (!hasCor) notes.push('Coût du risque indisponible: poids réalloué');
    factors = {
      roe: { value: inp.roe, percentile: roePct, weight: 0.30, weightedScore: roePct!=null?roePct*0.30:null, source:'ROE', notes:[]},
      roa: { value: inp.roa??null, percentile: roaPct, weight: 0.20, weightedScore: roaPct!=null?roaPct*0.20:null, source:'ROA', notes:[]},
      netIncomeGrowth: { value: inp.netIncomeGrowth??null, percentile: nigPct, weight: hasCor?0.20:0.275, weightedScore: nigPct!=null?nigPct*(hasCor?0.20:0.275):null, source:'NIG', notes:[]},
      costOfRisk: { value: inp.costOfRisk??null, percentile: corPct, weight: hasCor?0.15:0, weightedScore: corPct!=null?corPct*0.15:null, source:'CoR', notes:[]},
      stability: { value: inp.earningsStability??null, percentile: stabPct, weight: hasCor?0.15:0.225, weightedScore: stabPct!=null?stabPct*(hasCor?0.15:0.225):null, source:'Stability', notes:[]},
    };
  } else if (isIns) {
    const roePct = pct(inp.roe, useArr(inp,'roe'), true);
    const nigPct = pct(inp.netIncomeGrowth??null, useArr(inp,'netIncomeGrowth'), true);
    const crPct = pct(inp.combinedRatio??null, useArr(inp,'combinedRatio'), false);
    const irPct = pct(inp.investmentReturn??null, useArr(inp,'investmentReturn'), true);
    const stabPct = pct(inp.earningsStability??null, useArr(inp,'earningsStability'), true);
    factors = {
      roe: { value: inp.roe, percentile: roePct, weight: 0.30, weightedScore: roePct!=null?roePct*0.30:null, source:'ROE', notes:[]},
      netIncomeGrowth: { value: inp.netIncomeGrowth??null, percentile: nigPct, weight: 0.20, weightedScore: nigPct!=null?nigPct*0.20:null, source:'NIG', notes:[]},
      combinedRatio: { value: inp.combinedRatio??null, percentile: crPct, weight: 0.20, weightedScore: crPct!=null?crPct*0.20:null, source:'CR', notes:[]},
      investmentReturn: { value: inp.investmentReturn??null, percentile: irPct, weight: 0.15, weightedScore: irPct!=null?irPct*0.15:null, source:'IR', notes:[]},
      stability: { value: inp.earningsStability??null, percentile: stabPct, weight: 0.15, weightedScore: stabPct!=null?stabPct*0.15:null, source:'Stability', notes:[]},
    };
  } else {
    const roePct = pct(inp.roe, useArr(inp,'roe'), true);
    const epsPct = pct(inp.epsGrowth3y??null, useArr(inp,'epsGrowth3y'), true);
    const msPct = pct(inp.marginStability??null, useArr(inp,'marginStability'), true);
    const ccPct = pct(inp.cashConversion??null, useArr(inp,'cashConversion'), true);
    const accPct = pct(inp.accruals??null, useArr(inp,'accruals'), false);
    const stabPct = pct(inp.earningsStability??null, useArr(inp,'earningsStability'), true);
    factors = {
      roe: { value: inp.roe, percentile: roePct, weight: 0.25, weightedScore: roePct!=null?roePct*0.25:null, source:'ROE', notes:[]},
      epsGrowth3y: { value: inp.epsGrowth3y??null, percentile: epsPct, weight: 0.20, weightedScore: epsPct!=null?epsPct*0.20:null, source:'EPS3Y', notes:[]},
      marginStability: { value: inp.marginStability??null, percentile: msPct, weight: 0.15, weightedScore: msPct!=null?msPct*0.15:null, source:'Margin', notes:[]},
      cashConversion: { value: inp.cashConversion??null, percentile: ccPct, weight: 0.15, weightedScore: ccPct!=null?ccPct*0.15:null, source:'CC', notes:[]},
      accruals: { value: inp.accruals??null, percentile: accPct, weight: 0.10, weightedScore: accPct!=null?accPct*0.10:null, source:'Accruals', notes:[]},
      stability: { value: inp.earningsStability??null, percentile: stabPct, weight: 0.15, weightedScore: stabPct!=null?stabPct*0.15:null, source:'Stability', notes:[]},
    };
  }
  const avail = Object.values(factors).filter((f)=>f.percentile!=null) as FactorScore[];
  if (avail.length===0) return { score: null, factors, notes };
  const wSum = avail.reduce((a,f)=>a+f.weight,0);
  const sum = avail.reduce((a,f)=>a+(f.percentile!*(f.weight/wSum)),0);
  if (avail.length < Object.keys(factors).filter((k)=>factors[k].weight>0).length) notes.push(`EQ sur ${avail.length} facteurs`);
  return { score: clamp(Math.round(sum),0,100), factors, notes };
}
