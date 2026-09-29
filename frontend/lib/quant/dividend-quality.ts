import { calculatePercentile } from './normalization';
import { clamp } from './math';
import type { FactorScore } from './types';
export interface DQInputs {
  dividendYield: number | null;
  consistency: number | null; // 0..100 (e.g. 100 if 5/5 years paid)
  dividendGrowth: number | null; // CAGR
  payoutRatio: number | null;
  isExceptional?: boolean;
  peers: { yield:(number|null)[]; consistency:(number|null)[]; growth:(number|null)[]; payout:(number|null)[] };
}
export function computeDividendQualityScore(inp: DQInputs): { score:number|null; factors:Record<string,FactorScore>; notes:string[] }{
  const notes:string[]=[];
  let dy = inp.dividendYield;
  if (inp.isExceptional) { dy=null; notes.push('Dividende exceptionnel exclu'); }
  // payout sustainability: lower is better, but also penalize >80%
  let payoutForScore = inp.payoutRatio;
  // we want percentile where lower payout is better, except very low may be neutral; keep as is for percentile
  const yPct = calculatePercentile(dy, inp.peers.yield, true);
  const cPct = calculatePercentile(inp.consistency, inp.peers.consistency, true);
  const gPct = calculatePercentile(inp.dividendGrowth, inp.peers.growth, true);
  // For payout sustainability: invert: sustainable if payout in 20-60 range. Use heuristic score then percentile.
  // Simpler: compute sustainability score 0..100: 100 if payout 30-50, 80 if 50-70, 60 if 20-30 or 70-80, 30 if >80, 10 if >100.
  let payoutSustain: number|null = null;
  if (inp.payoutRatio!=null && Number.isFinite(inp.payoutRatio)) {
    const p = inp.payoutRatio;
    if (p<0) payoutSustain=20;
    else if (p<=20) payoutSustain=60;
    else if (p<=50) payoutSustain=100;
    else if (p<=70) payoutSustain=80;
    else if (p<=80) payoutSustain=60;
    else if (p<=100) payoutSustain=30;
    else payoutSustain=10;
    if (p>100) notes.push('Payout >100%: dividende non soutenable');
  }
  // Also compute percentile of sustainability? Use direct value as percentile-like (already 0..100)
  const sPct = payoutSustain; // already 0..100
  let dyScore = yPct; if (inp.payoutRatio!=null && inp.payoutRatio>100 && dyScore!=null) dyScore=Math.round(dyScore*0.5);
  const factors: Record<string,FactorScore> = {
    yield: { value: dy, percentile: dyScore, weight: 0.35, weightedScore: dyScore!=null?dyScore*0.35:null, source:'Yield', notes:[]},
    consistency: { value: inp.consistency, percentile: cPct, weight: 0.25, weightedScore: cPct!=null?cPct*0.25:null, source:'Consistency', notes:[]},
    growth: { value: inp.dividendGrowth, percentile: gPct, weight: 0.20, weightedScore: gPct!=null?gPct*0.20:null, source:'Growth', notes:[]},
    payout: { value: inp.payoutRatio, percentile: sPct, weight: 0.20, weightedScore: sPct!=null?sPct*0.20:null, source:'Payout', notes:[]},
  };
  const avail = Object.values(factors).filter((f)=>f.percentile!=null) as FactorScore[];
  if (avail.length===0) return { score:null, factors, notes };
  const wSum=avail.reduce((a,f)=>a+f.weight,0); const sum=avail.reduce((a,f)=>a+(f.percentile!*(f.weight/wSum)),0);
  return { score: clamp(Math.round(sum),0,100), factors, notes };
}
export function dividendConsistencyScore(yearsPaid: number, yearsWindow=5): number {
  // 100 if 5/5, linear
  return clamp(Math.round((yearsPaid/yearsWindow)*100),0,100);
}
export function dividendCAGR(valuesAsc: number[]): number|null {
  if(valuesAsc.length<2) return null; const first=valuesAsc[0], last=valuesAsc[valuesAsc.length-1];
  if(first<=0 || last<=0) return null; const n=valuesAsc.length-1; return Math.pow(last/first,1/n)-1;
}
