import { createPublicClient } from '@/lib/supabase/public';
import { notFound } from 'next/navigation';
export const revalidate = 300;
export default async function QuantSecurityPage({ params }: { params: { code: string } }) {
  const symbol = params.code.toUpperCase();
  const supabase = createPublicClient();
  const { data: inst } = await supabase.from('brvm_instruments').select('code,designation,secteur,famille_comptable').eq('code', symbol).maybeSingle();
  if (!inst) notFound();
  const { data: scores } = await supabase.from('quant_model_scores').select('*').eq('security_id', symbol).order('score_date',{ascending:false}).limit(3);
  const latest = scores?.[0] as unknown as { combined_alpha_score:number|null; price_momentum_score:number|null; value_score:number|null; earnings_quality_score:number|null; financial_strength_score:number|null; dividend_quality_score:number|null; classification:string; confidence_level:string; eligibility_status:string; penalties_json:unknown; calculation_notes:unknown } | undefined;
  const bar = (v:number|null)=> (<div className="h-2 bg-zinc-200 rounded"><div className="h-2 bg-emerald-600 rounded" style={{width: `${v ?? 0}%`}} /></div>);
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold">{inst.code} — {inst.designation}</h1>
      <p className="text-sm text-zinc-500">{inst.secteur} · {inst.famille_comptable}</p>
      {!latest ? <p className="mt-6 text-amber-700 bg-amber-50 p-4 rounded-xl">Données insuffisantes — score non calculable. Vérifiez l’historique de cours et les états financiers.</p> : (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-xl p-4"><p className="text-xs text-zinc-500">Combined Alpha</p><p className="text-3xl font-bold">{latest.combined_alpha_score ?? '—'}</p><p className="text-sm">{latest.classification} · fiabilité {latest.confidence_level}</p><p className="text-xs text-zinc-500 mt-1">Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.</p></div>
            <div className="border rounded-xl p-4"><p className="text-xs text-zinc-500">Price Momentum</p><p className="text-3xl font-bold">{latest.price_momentum_score ?? '—'}</p></div>
          </div>
          <div className="border rounded-xl p-4 space-y-2"><p className="font-semibold text-sm">Sous-scores</p>
            <div className="grid grid-cols-2 gap-3 text-sm"><span>Value</span>{bar(latest.value_score)}<span>Momentum</span>{bar(latest.price_momentum_score)}<span>Quality</span>{bar(latest.earnings_quality_score)}<span>Strength</span>{bar(latest.financial_strength_score)}<span>Dividende</span>{bar(latest.dividend_quality_score)}</div>
          </div>
          <div className="border rounded-xl p-4"><p className="font-semibold text-sm">Pénalités & notes</p><pre className="text-xs whitespace-pre-wrap mt-2 bg-zinc-50 p-3 rounded">{JSON.stringify({ penalties: latest.penalties_json, notes: latest.calculation_notes }, null, 2)}</pre></div>
          <p className="text-xs text-zinc-500">Ne constitue pas un conseil en investissement. À compléter par une analyse fondamentale et une vérification de liquidité.</p>
        </div>
      )}
    </div>
  );
}
