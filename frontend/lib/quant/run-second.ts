import type { Sector } from './types';
import { buildRaw } from './run-buildraw';
function nNum(v: unknown): number | null { return typeof v === 'number' && Number.isFinite(v) ? v : v != null && !isNaN(Number(v)) ? Number(v) : null; }
function pickLatest<T extends { periode: string }>(rows: T[]): T | null { if(!rows.length) return null; return [...rows].sort((a,b)=> b.periode.localeCompare(a.periode))[0] ?? null; }
function winsor(arr:(number|null)[]):(number|null)[] { const c=arr.filter((v):v is number=>v!=null&&Number.isFinite(v)).sort((a,b)=>a-b); if(c.length<5) return arr; const lo=c[Math.floor(0.05*(c.length-1))]; const hi=c[Math.floor(0.95*(c.length-1))]; return arr.map(v=>v==null?null:Math.max(lo,Math.min(hi,v))); }
export type Pillared = {
  symbol:string; sector:Sector; mom:number|null; liq:number|null; td:number|null; price:number|null; vol:number|null; clsMom:string;
  penalties:import('./types').Penalty[]; notes:string[];
  raw:Record<string,number|null>;
  valueScore:number|null; eqScore:number|null; fsScore:number|null; dqScore:number|null;
  valueFactors:Record<string,import('./types').FactorScore>;
  eqFactors:Record<string,import('./types').FactorScore>;
  fsFactors:Record<string,import('./types').FactorScore>;
  dqFactors:Record<string,import('./types').FactorScore>;
  globalRisk:number; confidence:import('./types').ConfidenceLevel; eligibility:import('./types').EligibilityStatus;
  combined:number|null; combinedCls:string; rankGlobal:number|null; rankSector:number|null;
};
export async function runSecondHalf(args: {
  calc: string; dryRun: boolean;
  moms: { symbol:string; sector:Sector; closes:number[]; price:number|null; shares:number|null; td:number|null; liq:number|null; mom:number|null; vol:number|null; cls:string; penalties: import('./types').Penalty[]; notes:string[] }[];
  incBy: Map<string, Record<string,unknown>[]>;
  balBy: Map<string, Record<string,unknown>[]>;
  cfBy: Map<string, Record<string,unknown>[]>;
  divBy: Map<string, Record<string,unknown>[]>;
}): Promise<{ calculationDate:string; dryRun:boolean; total:number; eligible:number; runs:{modelCode:string;runId:string|null}[]; results:{symbol:string;sector:Sector;priceMomentum:number|null;combinedAlpha:number|null;classification:string;confidence:string;eligibility:string;rankGlobal:number|null;rankSector:number|null}[]; note?:string }>{
  const { calc, dryRun, moms, incBy, balBy, cfBy, divBy } = args;
  const raws=new Map<string,ReturnType<typeof buildRaw>>(); const metas=new Map<string,{hasRecent:boolean;years:number;coverageRate:number}>();
  for(const m of moms){
    const incRows=incBy.get(m.symbol)??[]; const incAnn=incRows.filter(r=> String((r as {type_periode:string}).type_periode)==='annuel');
    const latestInc=pickLatest(incAnn as unknown as {periode:string}[]) as unknown as Record<string,unknown>|null;
    const sortedInc=[...incAnn].sort((a,b)=> String(a.periode).localeCompare(String(b.periode)));
    const prevInc=sortedInc.length>=2?sortedInc[sortedInc.length-2]:null;
    const balRows=balBy.get(m.symbol)??[]; const balAnn=balRows.filter(r=> String((r as {type_periode:string}).type_periode)==='annuel');
    const latestBal=pickLatest(balAnn as unknown as {periode:string}[]) as unknown as Record<string,unknown>|null;
    const cfRows=cfBy.get(m.symbol)??[]; const cfAnn=cfRows.filter(r=> String((r as {type_periode:string}).type_periode)==='annuel');
    const latestCf=pickLatest(cfAnn as unknown as {periode:string}[]) as unknown as Record<string,unknown>|null;
    const divRows=divBy.get(m.symbol)??[];
    const raw=buildRaw({ inc:latestInc, incPrev:prevInc as Record<string,unknown>|null, incHistory:incAnn, bal:latestBal, cf:latestCf, price:m.price, shares:m.shares, divRows });
    raws.set(m.symbol,raw);
    const years=new Set(incAnn.map(r=> String((r as {periode:string}).periode).slice(0,4))).size;
    const recentYear=incAnn.length? Number(String((incAnn[0] as {periode:string}).periode).slice(0,4)):0;
    const hasRecent=recentYear>= new Date().getFullYear()-1;
    const avail=Object.values(raw).filter(v=> v!=null).length; const coverageRate=Math.min(1,avail/12);
    metas.set(m.symbol,{hasRecent,years,coverageRate});
  }
  const peerKeys=['per','pb','dividendYield','evEbitda','earningsYield','roe','roa','epsGrowth3y','netIncomeGrowth','cashConversion','accruals','interestCoverage','netDebtToEbitda','debtToEquity','currentRatio','fcfToDebt'] as const;
  const globalPeers:Record<string,(number|null)[]>={}; for(const k of peerKeys) globalPeers[k]=[...raws.values()].map(r=> (r as Record<string,number|null>)[k] ?? null);
  for(const k of peerKeys) globalPeers[k]=winsor(globalPeers[k]);
  const sectorPeers=new Map<Sector,Record<string,(number|null)[]>>();
  for(const m of moms){ if(!sectorPeers.has(m.sector)) sectorPeers.set(m.sector,Object.fromEntries(peerKeys.map(k=>[k,[]])) as Record<string,(number|null)[]>); const sp=sectorPeers.get(m.sector)!; const r=raws.get(m.symbol)! as Record<string,number|null>; for(const k of peerKeys) sp[k].push(r[k]??null); }
  for(const [,sp] of sectorPeers) for(const k of peerKeys) sp[k]=winsor(sp[k]);
  const { buildPillared } = await import('./run-second-extra');
  const pillared = buildPillared({ moms, raws, metas, globalPeers, sectorPeers, incBy });
  const withC=pillared.filter(p=> p.combined!=null).sort((a,b)=> (b.combined! - a.combined!)); withC.forEach((p,i)=> p.rankGlobal=i+1);
  for(const s of new Set(pillared.map(p=> p.sector))){ const arr=pillared.filter(p=> p.sector===s && p.combined!=null).sort((a,b)=> (b.combined! - a.combined!)); arr.forEach((p,i)=> p.rankSector=i+1); }
  const total=pillared.length; const eligible=pillared.filter(p=> p.eligibility!=='ineligible' && p.combined!=null).length;
  if(dryRun) return { calculationDate:calc, dryRun, total, eligible, runs:[{modelCode:'WB_PRICE_MOMENTUM',runId:null},{modelCode:'WB_COMBINED_ALPHA',runId:null}], results: pillared.map(p=> ({symbol:p.symbol,sector:p.sector,priceMomentum:p.mom,combinedAlpha:p.combined,classification:p.combinedCls,confidence:p.confidence,eligibility:p.eligibility,rankGlobal:p.rankGlobal,rankSector:p.rankSector})) };
  const { finishPersist } = await import('./run-second-extra');
  return finishPersist({ calc, pillared });
}

