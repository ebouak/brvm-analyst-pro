import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';

export interface PricePoint { date: string; close: number; volume: number | null; tradedValue: number | null; }
export async function fetchPriceHistory(code: string, limit=300): Promise<PricePoint[]>{
  const supabase = createPublicClient();
  const { data } = await supabase.from('brvm_actions_daily').select('date_marche, cours_jour, volume, valeur_echangee').eq('code',code).order('date_marche',{ascending:true}).limit(limit);
  return (data??[]).map((r:any)=>({ date: r.date_marche, close: Number(r.cours_jour), volume: r.volume!=null?Number(r.volume):null, tradedValue: r.valeur_echangee!=null?Number(r.valeur_echangee):null })).filter((p)=>Number.isFinite(p.close) && p.close>0);
}
export async function fetchUniverseMeta(){
  const supabase = createPublicClient();
  const { data } = await supabase.from('brvm_instruments').select('code, designation, secteur, famille_comptable, actif').eq('type','action').eq('actif',true);
  return data ?? [];
}
export async function fetchFinancialsForCodes(codes: string[]){
  const supabase = createPublicClient();
  const { data: inc } = await supabase.from('income_statements').select('*').in('code',codes).order('periode',{ascending:false});
  const { data: bal } = await supabase.from('balance_sheets').select('*').in('code',codes).order('periode',{ascending:false});
  const { data: cf } = await supabase.from('cash_flow_statements').select('*').in('code',codes).order('periode',{ascending:false});
  const { data: div } = await supabase.from('dividends').select('*').in('code',codes).order('exercice',{ascending:false});
  return { inc: inc??[], bal: bal??[], cf: cf??[], div: div??[] };
}
export async function fetchDividends(code:string){
  const supabase = createPublicClient();
  const { data } = await supabase.from('dividends').select('*').eq('code',code).order('exercice',{ascending:false}).limit(6);
  return data??[];
}
