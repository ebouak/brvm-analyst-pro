import { calculatePercentile } from './normalization';
import { clamp, isFiniteNumber } from './math';
import type { Sector, FactorScore } from './types';
export interface FSInputs {
  sector: Sector;
  interestCoverage?: number | null; netDebtToEbitda?: number | null; debtToEquity?: number | null;
  currentRatio?: number | null; fcfToDebt?: number | null;
  capitalAdequacy?: number | null; nplRatio?: number | null; nplCoverage?: number | null;
  liquidityRatio?: number | null; depositGrowth?: number | null;
  solvencyRatio?: number | null; combinedRatio?: number | null; provisionCoverage?: number | null;
  peers: Record<string,(number|null)[]>; sectorPeers?: Record<string,(number|null)[]>;
}
function pct(v:number|null,arr:(number|null)[]|undefined,hib:boolean){ if(!arr) return null; return calculatePercentile(v,arr,hib); }
function useArr(inp:FSInputs,k:string){ const sp=inp.sectorPeers?.[k]; if(sp && sp.filter((x)=>x!=null && isFiniteNumber(x as number)).length>=5) return sp; return inp.peers[k]; }
export function computeFinancialStrengthScore(inp:FSInputs): { score:number|null; factors:Record<string,FactorScore>; notes:string[] }{
  const notes:string[]=[]; const isBank=inp.sector==='banks'; const isIns=inp.sector==='insurance';
  let factors:Record<string,FactorScore>={};
  if(isBank){
    const caPct=pct(inp.capitalAdequacy??null,useArr(inp,'capitalAdequacy'),true);
    const nplPct=pct(inp.nplRatio??null,useArr(inp,'nplRatio'),false);
    const covPct=pct(inp.nplCoverage??null,useArr(inp,'nplCoverage'),true);
    const liqPct=pct(inp.liquidityRatio??null,useArr(inp,'liquidityRatio'),true);
    const depPct=pct(inp.depositGrowth??null,useArr(inp,'depositGrowth'),true);
    const hasPrud = caPct!=null || nplPct!=null;
    if(!hasPrud){ notes.push('Données prudentielles insuffisantes: score plafonné à 70'); }
    factors={
      capitalAdequacy:{value:inp.capitalAdequacy??null,percentile:caPct,weight:0.30,weightedScore:caPct!=null?caPct*0.30:null,source:'CAR',notes:[]},
      nplRatio:{value:inp.nplRatio??null,percentile:nplPct,weight:0.25,weightedScore:nplPct!=null?nplPct*0.25:null,source:'NPL',notes:[]},
      nplCoverage:{value:inp.nplCoverage??null,percentile:covPct,weight:0.20,weightedScore:covPct!=null?covPct*0.20:null,source:'Coverage',notes:[]},
      liquidity:{value:inp.liquidityRatio??null,percentile:liqPct,weight:0.15,weightedScore:liqPct!=null?liqPct*0.15:null,source:'Liquidity',notes:[]},
      depositGrowth:{value:inp.depositGrowth??null,percentile:depPct,weight:0.10,weightedScore:depPct!=null?depPct*0.10:null,source:'Deposits',notes:[]},
    };
    const avail=Object.values(factors).filter((f)=>f.percentile!=null) as FactorScore[];
    if(avail.length===0) return {score:null,factors,notes};
    const wSum=avail.reduce((a,f)=>a+f.weight,0); let sum=avail.reduce((a,f)=>a+(f.percentile!*(f.weight/wSum)),0);
    let score=clamp(Math.round(sum),0,100); if(!hasPrud) score=Math.min(score,70); return {score,factors,notes};
  }
  if(isIns){
    const solvPct=pct(inp.solvencyRatio??null,useArr(inp,'solvencyRatio'),true);
    const crPct=pct(inp.combinedRatio??null,useArr(inp,'combinedRatio'),false);
    const provPct=pct(inp.provisionCoverage??null,useArr(inp,'provisionCoverage'),true);
    const liqPct=pct(inp.liquidityRatio??null,useArr(inp,'liquidityRatio'),true);
    const hasPrud=solvPct!=null;
    if(!hasPrud) notes.push('Solvabilité indisponible: score plafonné à 70');
    factors={
      solvency:{value:inp.solvencyRatio??null,percentile:solvPct,weight:0.35,weightedScore:solvPct!=null?solvPct*0.35:null,source:'Solvency',notes:[]},
      combinedRatio:{value:inp.combinedRatio??null,percentile:crPct,weight:0.25,weightedScore:crPct!=null?crPct*0.25:null,source:'CR',notes:[]},
      provisionCoverage:{value:inp.provisionCoverage??null,percentile:provPct,weight:0.20,weightedScore:provPct!=null?provPct*0.20:null,source:'ProvCov',notes:[]},
      liquidity:{value:inp.liquidityRatio??null,percentile:liqPct,weight:0.20,weightedScore:liqPct!=null?liqPct*0.20:null,source:'Liquidity',notes:[]},
    };
    const avail=Object.values(factors).filter((f)=>f.percentile!=null) as FactorScore[];
    if(avail.length===0) return {score:null,factors,notes};
    const wSum=avail.reduce((a,f)=>a+f.weight,0); let sum=avail.reduce((a,f)=>a+(f.percentile!*(f.weight/wSum)),0);
    let score=clamp(Math.round(sum),0,100); if(!hasPrud) score=Math.min(score,70); return {score,factors,notes};
  }
  const icPct=pct(inp.interestCoverage??null,useArr(inp,'interestCoverage'),true);
  const ndPct=pct(inp.netDebtToEbitda??null,useArr(inp,'netDebtToEbitda'),false);
  const dePct=pct(inp.debtToEquity??null,useArr(inp,'debtToEquity'),false);
  const crPct=pct(inp.currentRatio??null,useArr(inp,'currentRatio'),true);
  const fcfPct=pct(inp.fcfToDebt??null,useArr(inp,'fcfToDebt'),true);
  factors={
    interestCoverage:{value:inp.interestCoverage??null,percentile:icPct,weight:0.30,weightedScore:icPct!=null?icPct*0.30:null,source:'IC',notes:[]},
    netDebtToEbitda:{value:inp.netDebtToEbitda??null,percentile:ndPct,weight:0.25,weightedScore:ndPct!=null?ndPct*0.25:null,source:'ND/EBITDA',notes:[]},
    debtToEquity:{value:inp.debtToEquity??null,percentile:dePct,weight:0.20,weightedScore:dePct!=null?dePct*0.20:null,source:'D/E',notes:[]},
    currentRatio:{value:inp.currentRatio??null,percentile:crPct,weight:0.15,weightedScore:crPct!=null?crPct*0.15:null,source:'CR',notes:[]},
    fcfToDebt:{value:inp.fcfToDebt??null,percentile:fcfPct,weight:0.10,weightedScore:fcfPct!=null?fcfPct*0.10:null,source:'FCF/D',notes:[]},
  };
  const avail=Object.values(factors).filter((f)=>f.percentile!=null) as FactorScore[];
  if(avail.length===0) return {score:null,factors,notes};
  const wSum=avail.reduce((a,f)=>a+f.weight,0); const sum=avail.reduce((a,f)=>a+(f.percentile!*(f.weight/wSum)),0);
  return {score:clamp(Math.round(sum),0,100),factors,notes};
}
