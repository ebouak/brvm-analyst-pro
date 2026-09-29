import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const sector = searchParams.get('sector');
  const classification = searchParams.get('classification');
  const minScore = searchParams.get('minScore');
  const supabase = createClient();
  // latest run
  const { data: run } = await supabase.from('quant_model_runs').select('*').eq('model_code','WB_COMBINED_ALPHA').order('calculation_date',{ascending:false}).limit(1).maybeSingle();
  if (!run) return NextResponse.json({ run: null, results: [], total: 0, legalNotice: 'Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.' });
  let q = supabase.from('quant_model_scores').select('*', { count: 'exact' }).eq('run_id', run.id).order('combined_alpha_score', { ascending: false }).range(offset, offset+limit-1);
  // sector non stocké dans quant_model_scores — filtre ignoré (documenté via ?sector)
  void sector;
  if (classification) q = q.eq('classification', classification);
  if (minScore) q = q.gte('combined_alpha_score', parseInt(minScore,10));
  const { data, count } = await q;
  // enrich with instrument labels
  const codes = (data??[]).map((r:{security_id:string})=>r.security_id);
  let labels: Record<string,{designation:string,secteur:string|null}> = {};
  if (codes.length) {
    const { data: insts } = await supabase.from('brvm_instruments').select('code,designation,secteur').in('code', codes);
    for (const i of (insts??[]) as {code:string;designation:string;secteur:string|null}[]) labels[i.code]=i;
  }
  const results = (data??[]).map((r:{security_id:string; combined_alpha_score:number|null; value_score:number|null; earnings_quality_score:number|null; financial_strength_score:number|null; dividend_quality_score:number|null; price_momentum_score:number|null; rank_global:number|null; classification:string; confidence_level:string; eligibility_status:string; liquidity_score:number|null})=>({
    symbol: r.security_id, designation: labels[r.security_id]?.designation ?? r.security_id, secteur: labels[r.security_id]?.secteur ?? null,
    combinedAlpha: r.combined_alpha_score, value: r.value_score, earningsQuality: r.earnings_quality_score, financialStrength: r.financial_strength_score, dividendQuality: r.dividend_quality_score, momentum: r.price_momentum_score,
    rank: r.rank_global, classification: r.classification, confidence: r.confidence_level, eligibility: r.eligibility_status, liquidity: r.liquidity_score,
  }));
  return NextResponse.json({ run: { id: run.id, calculationDate: run.calculation_date, version: run.model_version, total: run.total_securities, eligible: run.eligible_securities }, results, total: count ?? results.length, legalNotice: 'Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.' });
}
