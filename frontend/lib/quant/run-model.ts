import { createPublicClient } from '@/lib/supabase/public';
import brvmSectors from '@/lib/brvmSectors.json';
import type { Sector } from './types';
import { MODEL_VERSION_CURRENT, classifyMomentum } from './constants';
export { MODEL_VERSION_CURRENT };
import { computeMomentumFactors, scorePriceMomentum, computeAnnualizedVol } from './price-momentum';
import { computeLiquidityScore } from './liquidity';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { runSecondHalf } from './run-second';
function sectorFromMeta(famille: string | null, secteur: string | null): Sector {
  if (famille === 'banque') return 'banks';
  const s = (secteur ?? '').toLowerCase();
  if (s.includes('assur')) return 'insurance';
  if (s.includes('telecom')) return 'telecom';
  return 'other';
}
function nNum(v: unknown): number | null { return typeof v === 'number' && Number.isFinite(v) ? v : v != null && !isNaN(Number(v)) ? Number(v) : null; }

export async function runQuantModels(opts: { calculationDate?: string; dryRun?: boolean } = {}): Promise<{
  calculationDate: string; dryRun: boolean; total: number; eligible: number;
  runs: { modelCode: string; runId: string|null }[];
  results: { symbol: string; sector: Sector; priceMomentum: number|null; combinedAlpha: number|null; classification: string; confidence: string; eligibility: string; rankGlobal: number|null; rankSector: number|null }[];
  note?: string;
}> {
  const calc = opts.calculationDate ?? new Date().toISOString().slice(0,10);
  const dryRun = !!opts.dryRun;
  const pub = createPublicClient();
  const insts = await fetchAllRows<{code:string; secteur:string|null; famille_comptable:string|null; shares:number|null; actif:boolean}>(
    (f,t)=> pub.from('brvm_instruments').select('code,secteur,famille_comptable,shares,actif').eq('type','action').eq('actif',true).order('code',{ascending:true}).range(f,t)
  ) as unknown as {code:string; secteur:string|null; famille_comptable:string|null; shares:number|null; actif:boolean}[];
  const codes = insts.map(i=> i.code);
  if (!codes.length) return { calculationDate: calc, dryRun, total: 0, eligible: 0, runs: [], results: [], note: 'Aucun instrument' };
  type DailyRow = { code:string; date_marche:string; cours_jour:number|null; volume:number|null; valeur_echangee:number|null };
  const dailyAll = await fetchAllRows<DailyRow>((f,t)=> pub.from('brvm_actions_daily').select('code,date_marche,cours_jour,volume,valeur_echangee').in('code',codes).order('date_marche',{ascending:true}).range(f,t)) as unknown as DailyRow[];
  const byCode = new Map<string, DailyRow[]>(); for(const r of dailyAll){ if(!byCode.has(r.code)) byCode.set(r.code,[]); byCode.get(r.code)!.push(r); }
  const liqRaw = new Map<string,{ td:number|null; av:number|null; tv:number|null; closes:number[]; price:number|null }>();
  const allTD:number[]=[]; const allAV:number[]=[]; const allTV:number[]=[]; const vols:number[]=[];
  for(const inst of insts){
    const rows = (byCode.get(inst.code) ?? []).filter(r=> r.cours_jour!=null && Number.isFinite(Number(r.cours_jour)) && Number(r.cours_jour)>0);
    const closes = rows.map(r=> Number(r.cours_jour)); const last90 = rows.slice(-90);
    const td = last90.length ? last90.filter(r=> nNum(r.volume)!=null && nNum(r.volume)!>0).length : null;
    const vals = last90.map(r=> nNum(r.valeur_echangee)).filter((v):v is number=> v!=null) as number[];
    const av = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    const tv = last90.length ? last90.reduce((s,r)=> s + (nNum(r.volume)??0),0) : null;
    const v = closes.length>=30 ? computeAnnualizedVol(closes) : null;
    liqRaw.set(inst.code,{ td, av, tv, closes, price: closes.length? closes[closes.length-1]: null });
    if(td!=null) allTD.push(td); if(av!=null) allAV.push(av); if(tv!=null) allTV.push(tv); if(v!=null) vols.push(v);
  }
  const moms: {symbol:string; sector:Sector; closes:number[]; price:number|null; shares:number|null; td:number|null; liq:number|null; mom:number|null; vol:number|null; cls:string; penalties: import('./types').Penalty[]; notes:string[]}[] = [];
  for(const inst of insts){
    const s = sectorFromMeta(inst.famille_comptable, inst.secteur ?? (brvmSectors as Record<string,string>)[inst.code] ?? null);
    const raw = liqRaw.get(inst.code)!;
    const { liquidityScore, notes: lgNotes } = computeLiquidityScore({ tradingDays90: raw.td, avgTradedValue90: raw.av, totalVolume90: raw.tv, peerTradingDays: allTD, peerAvgValue: allAV, peerVolume: allTV });
    const f = computeMomentumFactors(raw.closes); const v = raw.closes.length>=30 ? computeAnnualizedVol(raw.closes) : null;
    const sc = scorePriceMomentum({ ...f, liquidityScore, annualizedVol: v }, { volPeers: vols });
    moms.push({ symbol: inst.code, sector: s, mom: sc.score, liq: liquidityScore, td: raw.td, price: raw.price, vol: v, cls: classifyMomentum(sc.score), penalties: sc.penalties, notes: [...lgNotes, ...sc.notes], closes: raw.closes, shares: nNum(inst.shares) });
  }
  const incAll = await fetchAllRows<Record<string,unknown>>((f,t)=> pub.from('income_statements').select('*').in('code',codes).order('periode',{ascending:false}).range(f,t)) as unknown as Record<string,unknown>[];
  const balAll = await fetchAllRows<Record<string,unknown>>((f,t)=> pub.from('balance_sheets').select('*').in('code',codes).order('periode',{ascending:false}).range(f,t)) as unknown as Record<string,unknown>[];
  const cfAll = await fetchAllRows<Record<string,unknown>>((f,t)=> pub.from('cash_flow_statements').select('*').in('code',codes).order('periode',{ascending:false}).range(f,t)) as unknown as Record<string,unknown>[];
  const divAll = await fetchAllRows<Record<string,unknown>>((f,t)=> pub.from('dividends').select('*').in('code',codes).order('exercice',{ascending:false}).range(f,t)) as unknown as Record<string,unknown>[];
  const incBy=new Map<string,Record<string,unknown>[]>(); for(const r of incAll){const c=String((r as {code:string}).code); if(!incBy.has(c)) incBy.set(c,[]); incBy.get(c)!.push(r);}
  const balBy=new Map<string,Record<string,unknown>[]>(); for(const r of balAll){const c=String((r as {code:string}).code); if(!balBy.has(c)) balBy.set(c,[]); balBy.get(c)!.push(r);}
  const cfBy=new Map<string,Record<string,unknown>[]>(); for(const r of cfAll){const c=String((r as {code:string}).code); if(!cfBy.has(c)) cfBy.set(c,[]); cfBy.get(c)!.push(r);}
  const divBy=new Map<string,Record<string,unknown>[]>(); for(const r of divAll){const c=String((r as {code:string}).code); if(!divBy.has(c)) divBy.set(c,[]); divBy.get(c)!.push(r);}
  return runSecondHalf({ calc, dryRun, moms, incBy, balBy, cfBy, divBy });
}
