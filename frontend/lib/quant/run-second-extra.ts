import type { Sector } from './types';
import type { Pillared } from './run-second';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { MODEL_VERSION } from './types';
import { classifyCombinedAlpha } from './constants';
import { computeValueScore } from './value';
import { computeEarningsQualityScore } from './earnings-quality';
import { computeFinancialStrengthScore } from './financial-strength';
import { computeDividendQualityScore } from './dividend-quality';
import { computeCombinedAlpha, computeGlobalRiskPenalty, confidenceFromCoverage } from './combined-alpha';
import { assessEligibility } from './eligibility';
function nNum(v: unknown): number | null { return typeof v === 'number' && Number.isFinite(v) ? v : v != null && !isNaN(Number(v)) ? Number(v) : null; }
export function buildPillared(args: {
  moms: { symbol:string; sector:Sector; closes:number[]; price:number|null; shares:number|null; td:number|null; liq:number|null; mom:number|null; vol:number|null; cls:string; penalties: import('./types').Penalty[]; notes:string[] }[];
  raws: Map<string, Record<string,number|null>>;
  metas: Map<string,{hasRecent:boolean;years:number;coverageRate:number}>;
  globalPeers: Record<string,(number|null)[]>;
  sectorPeers: Map<Sector,Record<string,(number|null)[]>>;
  incBy: Map<string, Record<string,unknown>[]>;
}): Pillared[] {
  const { moms, raws, metas, globalPeers, sectorPeers, incBy } = args;
  const out:Pillared[]=[];
  for(const m of moms){
    const raw=raws.get(m.symbol)! as unknown as Record<string,number|null>;
    const meta=metas.get(m.symbol)!;
    const sp=sectorPeers.get(m.sector) ?? globalPeers;
    const gp=globalPeers;
    const valRes=computeValueScore({
      sector:m.sector, per:raw.per as number|null, pb:raw.pb as number|null,
      dividendYield:raw.dividendYield as number|null, evEbitda:raw.evEbitda as number|null,
      earningsYield:raw.earningsYield as number|null, roe:raw.roe as number|null,
      netIncome: (raw as unknown as {_metaRn:number|null})._metaRn ?? null, ebitda: null,
      payoutRatio: raw.payoutRatio as number|null,
      peers:{per:gp.per,pb:gp.pb,divYield:gp.dividendYield,evEbitda:gp.evEbitda,earningsYield:gp.earningsYield,roe:gp.roe},
      sectorPeers:{per:sp.per,pb:sp.pb,divYield:sp.dividendYield,evEbitda:sp.evEbitda,earningsYield:sp.earningsYield}
    } as unknown as Parameters<typeof computeValueScore>[0]);
    const eqPeers:Record<string,(number|null)[]>={roe:gp.roe} as unknown as Record<string,(number|null)[]>;
    const eqSP:Record<string,(number|null)[]>={roe:sp.roe} as unknown as Record<string,(number|null)[]>;
    const allK=['roa','epsGrowth3y','netIncomeGrowth','cashConversion','accruals','interestCoverage','netDebtToEbitda','debtToEquity','currentRatio','fcfToDebt'] as const;
    for(const k of allK){ if(!(k in eqPeers)) eqPeers[k]=gp[k]; if(!(k in eqSP)) eqSP[k]=sp[k]??gp[k]; }
    const eqRes=computeEarningsQualityScore({
      sector:m.sector, roe:raw.roe as number|null, epsGrowth3y:raw.epsGrowth3y as number|null,
      marginStability: (raw as Record<string,number|null>).marginStability ?? null,
      cashConversion: raw.cashConversion as number|null, accruals: raw.accruals as number|null,
      earningsStability: (raw as Record<string,number|null>).earningsStability ?? null,
      roa:raw.roa as number|null, netIncomeGrowth:raw.netIncomeGrowth as number|null,
      costOfRisk:null, combinedRatio:raw.combinedRatio as number|null, investmentReturn:null,
      peers:eqPeers, sectorPeers:eqSP
    } as unknown as Parameters<typeof computeEarningsQualityScore>[0]);
    const fsRes=computeFinancialStrengthScore({
      sector:m.sector, interestCoverage:raw.interestCoverage as number|null,
      netDebtToEbitda:raw.netDebtToEbitda as number|null, debtToEquity:raw.debtToEquity as number|null,
      currentRatio:raw.currentRatio as number|null, fcfToDebt:raw.fcfToDebt as number|null,
      capitalAdequacy:raw.capitalAdequacy as number|null, nplRatio:raw.nplRatio as number|null, nplCoverage:raw.nplCoverage as number|null,
      liquidityRatio:raw.liquidityRatio as number|null, depositGrowth:raw.depositGrowth as number|null,
      solvencyRatio:raw.solvencyRatio as number|null, combinedRatio:raw.combinedRatio as number|null,
      provisionCoverage:null,
      peers:gp as unknown as Record<string,(number|null)[]>, sectorPeers:sp as unknown as Record<string,(number|null)[]>
    } as unknown as Parameters<typeof computeFinancialStrengthScore>[0]);
    const dqPeers={
      yield:gp.dividendYield,
      consistency:[...raws.values()].map(r=> (r as Record<string,number|null>).dividendConsistency ?? null),
      growth:[...raws.values()].map(r=> (r as Record<string,number|null>).dividendGrowth ?? null),
      payout:[...raws.values()].map(r=> (r as Record<string,number|null>).payoutRatio ?? null)
    };
    const dqRes=computeDividendQualityScore({
      dividendYield:raw.dividendYield as number|null,
      consistency: (raw as Record<string,number|null>).dividendConsistency ?? null,
      dividendGrowth: (raw as Record<string,number|null>).dividendGrowth ?? null,
      payoutRatio: raw.payoutRatio as number|null,
      peers: dqPeers as unknown as {yield:(number|null)[];consistency:(number|null)[];growth:(number|null)[];payout:(number|null)[]}
    } as unknown as Parameters<typeof computeDividendQualityScore>[0]);
    const hasNeg=(raw as unknown as {_metaCapitaux:number|null})._metaCapitaux!=null && (raw as unknown as {_metaCapitaux:number|null})._metaCapitaux! <0;
    const sInc=[... (incBy.get(m.symbol)??[])].filter(r=> String((r as {type_periode:string}).type_periode)==='annuel').sort((a,b)=> String(a.periode).localeCompare(String(b.periode)));
    let cLoss=0; for(let i=sInc.length-1;i>=0;i--){const v=nNum((sInc[i] as Record<string,unknown>).resultat_net); if(v!=null&&v<0) cLoss++; else break; }
    const gRisk=computeGlobalRiskPenalty({
      negativeEquity:!!hasNeg, consecutiveLosses:cLoss,
      missingRecentFinancials:!meta.hasRecent, veryIlliquid:(m.liq??100)<20,
      uncertainCriticalData: meta.coverageRate<0.6?10:undefined,
      unsustainableDividend: ((raw as Record<string,number|null>).payoutRatio??0)>120
    });
    const conf=confidenceFromCoverage(meta.coverageRate, meta.hasRecent, m.liq);
    const elig=assessEligibility({
      hasClose:m.price!=null, hasHistory:m.closes.length>=60,
      hasRecentFinancials:meta.hasRecent, yearsOfFinancials:meta.years,
      tradingDays90:m.td, liquidityScore:m.liq, coverageRate:meta.coverageRate
    });
    const pillars={ value:valRes.score, momentum:m.mom, earningsQuality:eqRes.score, financialStrength:fsRes.score, dividendQuality:dqRes.score };
    const comb=computeCombinedAlpha(pillars as unknown as Parameters<typeof computeCombinedAlpha>[0], { globalRiskPenaltyInput:gRisk, confidence:conf, notes:[] });
    const fCls=comb.classification ?? classifyCombinedAlpha(comb.score, conf);
    out.push({
      symbol:m.symbol, sector:m.sector, mom:m.mom, liq:m.liq, td:m.td, price:m.price, vol:m.vol, clsMom:m.cls,
      penalties:[...m.penalties], notes:[...m.notes,...valRes.notes,...eqRes.notes,...fsRes.notes,...dqRes.notes,...comb.notes],
      raw, valueScore:valRes.score, eqScore:eqRes.score, fsScore:fsRes.score, dqScore:dqRes.score,
      valueFactors:valRes.factors, eqFactors:eqRes.factors, fsFactors:fsRes.factors, dqFactors:dqRes.factors,
      globalRisk:gRisk, confidence:conf, eligibility:elig.status as import('./types').EligibilityStatus,
      combined:comb.score, combinedCls:fCls, rankGlobal:null, rankSector:null
    });
  }
  return out;
}
export async function finishPersist(args: { calc:string; pillared: ReturnType<typeof buildPillared> }): Promise<{ calculationDate:string; dryRun:boolean; total:number; eligible:number; runs:{modelCode:string;runId:string|null}[]; results:{symbol:string;sector:Sector;priceMomentum:number|null;combinedAlpha:number|null;classification:string;confidence:string;eligibility:string;rankGlobal:number|null;rankSector:number|null}[]; note?:string }>{
  const { calc, pillared } = args;
  const withC=pillared.filter(p=> p.combined!=null).sort((a,b)=> (b.combined! - a.combined!)); withC.forEach((p,i)=> p.rankGlobal=i+1);
  for(const s of new Set(pillared.map(p=> p.sector))){ const arr=pillared.filter(p=> p.sector===s && p.combined!=null).sort((a,b)=> (b.combined! - a.combined!)); arr.forEach((p,i)=> p.rankSector=i+1); }
  const total=pillared.length; const eligible=pillared.filter(p=> p.eligibility!=='ineligible' && p.combined!=null).length;
  const svc=getServiceClient();
  const persist=async(modelCode:'WB_PRICE_MOMENTUM'|'WB_COMBINED_ALPHA')=>{
    const tot=pillared.length; const elig=pillared.filter(p=> p.eligibility!=='ineligible').length;
    const { data:run, error }=await svc.from('quant_model_runs').insert({ model_code:modelCode, model_version:MODEL_VERSION, calculation_date:calc, universe_name:'BRVM actions', parameters_json:{}, status:'completed', total_securities:tot, eligible_securities:elig }).select('id').single();
    if(error||!run) return null; const runId=(run as {id:string}).id;
    const rows=pillared.map(p=> ({ run_id:runId, security_id:p.symbol, score_date:calc, price_momentum_score:p.mom, value_score:p.valueScore, earnings_quality_score:p.eqScore, financial_strength_score:p.fsScore, dividend_quality_score:p.dqScore, combined_alpha_score:p.combined, liquidity_score:p.liq, raw_metrics_json:p.raw, factor_scores_json:{value:p.valueFactors,earningsQuality:p.eqFactors,financialStrength:p.fsFactors,dividendQuality:p.dqFactors,momentum:{score:p.mom,classification:p.clsMom}}, penalties_json:[...p.penalties,...(p.globalRisk?[{code:'RISK',label:'Risque global',points:p.globalRisk,reason:'penalite risque'}]:[])], rank_global:p.rankGlobal, rank_sector:p.rankSector, eligibility_status:p.eligibility, confidence_level:p.confidence, classification: modelCode==='WB_PRICE_MOMENTUM'?p.clsMom:p.combinedCls, calculation_notes:p.notes }));
    for(let i=0;i<rows.length;i+=200){ const ch=rows.slice(i,i+200); const {error:e2}=await svc.from('quant_model_scores').insert(ch); if(e2) throw e2; }
    return runId;
  };
  const a=await persist('WB_PRICE_MOMENTUM'); const b=await persist('WB_COMBINED_ALPHA');
  return { calculationDate:calc, dryRun:false, total, eligible, runs:[{modelCode:'WB_PRICE_MOMENTUM',runId:a},{modelCode:'WB_COMBINED_ALPHA',runId:b}], results: pillared.map(p=> ({symbol:p.symbol,sector:p.sector,priceMomentum:p.mom,combinedAlpha:p.combined,classification:p.combinedCls,confidence:p.confidence,eligibility:p.eligibility,rankGlobal:p.rankGlobal,rankSector:p.rankSector})) };
}