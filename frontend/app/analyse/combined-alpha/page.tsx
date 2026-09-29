import { createPublicClient } from '@/lib/supabase/public';
export const revalidate = 300;
export default async function CombinedAlphaPage() {
  const supabase = createPublicClient();
  const { data: run } = await supabase.from('quant_model_runs').select('*').eq('model_code','WB_COMBINED_ALPHA').order('calculation_date',{ascending:false}).limit(1).maybeSingle();
  let rows: {security_id:string; combined_alpha_score:number|null; value_score:number|null; earnings_quality_score:number|null; financial_strength_score:number|null; dividend_quality_score:number|null; price_momentum_score:number|null; rank_global:number|null; classification:string; confidence_level:string}[] = [];
  if (run) {
    const { data } = await supabase.from('quant_model_scores').select('security_id,combined_alpha_score,value_score,earnings_quality_score,financial_strength_score,dividend_quality_score,price_momentum_score,rank_global,classification,confidence_level').eq('run_id', run.id).order('combined_alpha_score',{ascending:false}).limit(50);
    rows = (data as typeof rows) ?? [];
  }
  const codes = rows.map(r=>r.security_id);
  let labels: Record<string,string> = {};
  if (codes.length) {
    const { data: insts } = await supabase.from('brvm_instruments').select('code,designation').in('code', codes);
    for (const i of (insts??[]) as {code:string;designation:string}[]) labels[i.code]=i.designation;
  }
  const pill = (s:string)=>{
    if(s==='Strong Buy Quant') return 'bg-emerald-700 text-white';
    if(s==='Buy Quant') return 'bg-emerald-600 text-white';
    if(s==='Watchlist / Neutral') return 'bg-yellow-500 text-black';
    if(s==='Reduce / Avoid') return 'bg-orange-500 text-white';
    if(s==='High Risk / Avoid') return 'bg-red-600 text-white';
    return 'bg-zinc-600 text-white';
  };
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Westbourse Combined Alpha</h1>
      <p className="text-sm text-zinc-500 mt-1">Classement multifactoriel des actions BRVM selon la valorisation, le momentum, la qualité financière, la solidité et le dividende.</p>
      <p className="text-xs text-zinc-400 mt-1">Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.</p>
      {run ? <p className="text-xs text-zinc-500 mt-2">Dernier calcul: {String(run.calculation_date)} · v{String(run.model_version)} · {String(run.eligible_securities)}/{String(run.total_securities)} éligibles</p> : <p className="text-sm text-amber-600 mt-4">Aucun calcul disponible. Lancez un run via POST /api/admin/quant/run (admin).</p>}
      <div className="overflow-x-auto mt-6 border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs"><tr><th className="p-2 text-left">Rang</th><th className="p-2 text-left">Ticker</th><th className="p-2 text-left">Société</th><th className="p-2 text-right">Combined</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Momentum</th><th className="p-2 text-right">Quality</th><th className="p-2 text-right">Strength</th><th className="p-2 text-right">Dividende</th><th className="p-2">Signal</th></tr></thead>
          <tbody>{rows.map(r=> (<tr key={r.security_id} className="border-t"><td className="p-2">{r.rank_global ?? '—'}</td><td className="p-2 font-mono"><a className="text-blue-600 hover:underline" href={`/actions/${r.security_id}/quant`}>{r.security_id}</a></td><td className="p-2">{labels[r.security_id] ?? ''}</td><td className="p-2 text-right font-semibold">{r.combined_alpha_score ?? '—'}</td><td className="p-2 text-right">{r.value_score ?? '—'}</td><td className="p-2 text-right">{r.price_momentum_score ?? '—'}</td><td className="p-2 text-right">{r.earnings_quality_score ?? '—'}</td><td className="p-2 text-right">{r.financial_strength_score ?? '—'}</td><td className="p-2 text-right">{r.dividend_quality_score ?? '—'}</td><td className="p-2"><span className={`px-2 py-1 rounded-full text-xs ${pill(r.classification)}`}>{r.classification}</span></td></tr>))}</tbody>
        </table>
      </div>
      <details className="mt-6 text-xs text-zinc-600"><summary className="cursor-pointer">Méthodologie</summary><p className="mt-2 leading-relaxed">Combined Alpha = 30% Value + 25% Price Momentum + 20% Earnings Quality + 15% Financial Strength + 10% Dividend Quality − pénalité risque (≤25). Price Momentum = 0.40×M12_1 + 0.25×M6M + 0.15×M3M + 0.10×Proximité 52S + 0.10×Tendance − pénalités liquidité/volatilité. Normalisation par percentile sectoriel si ≥5 comparables, sinon univers global, avec winsorisation 5–95%. Inspiré des principes multifactoriels, sans réplication du modèle propriétaire LSEG StarMine.</p></details>
    </div>
  );
}
