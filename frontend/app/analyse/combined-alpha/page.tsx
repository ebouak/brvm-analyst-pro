import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel, MetricCard, StatPill, Eyebrow, EmptyStatePremium } from '@/components/ui/premium';

export const revalidate = 300;
export const metadata = { title: 'Combined Alpha — classement quant BRVM' };

function signalCls(c: string): string {
  if (c === 'Strong Buy Quant') return 'border-up/30 bg-up/10 text-up';
  if (c === 'Buy Quant') return 'border-up/20 bg-up/[0.07] text-up';
  if (c === 'Watchlist / Neutral') return 'border-warn/30 bg-warn/10 text-warn';
  if (c === 'Reduce / Avoid') return 'border-down/20 bg-down/10 text-down';
  if (c === 'High Risk / Avoid') return 'border-down/30 bg-down/15 text-down';
  return 'border-border bg-elevated text-faint';
}
function tone(v: number | null): string {
  if (v == null) return 'text-faint';
  if (v >= 70) return 'text-up';
  if (v >= 50) return 'text-warn';
  return 'text-down';
}

export default async function CombinedAlphaPage() {
  const supabase = createPublicClient();
  const { data: run } = await supabase.from('quant_model_runs').select('*').eq('model_code','WB_COMBINED_ALPHA').order('calculation_date',{ascending:false}).limit(1).maybeSingle();
  type Row = { security_id:string; combined_alpha_score:number|null; value_score:number|null; earnings_quality_score:number|null; financial_strength_score:number|null; dividend_quality_score:number|null; price_momentum_score:number|null; rank_global:number|null; classification:string; confidence_level:string };
  let rows: Row[] = [];
  if (run) {
    const { data } = await supabase.from('quant_model_scores').select('security_id,combined_alpha_score,value_score,earnings_quality_score,financial_strength_score,dividend_quality_score,price_momentum_score,rank_global,classification,confidence_level').eq('run_id', (run as {id:string}).id).order('combined_alpha_score',{ascending:false,nullsFirst:true}).limit(60);
    rows = ((data as Row[] | null) ?? []).sort((a,b)=> (b.combined_alpha_score??-1)-(a.combined_alpha_score??-1));
  }
  let labels: Record<string,string> = {};
  if (rows.length) {
    const { data: insts } = await supabase.from('brvm_instruments').select('code,designation').in('code', rows.map(r=>r.security_id));
    for (const i of (insts ?? []) as {code:string;designation:string|null}[]) labels[i.code]= i.designation ?? i.code;
  }
  const runDate = run ? String((run as {calculation_date:string}).calculation_date) : null;
  const runVer = run ? String((run as {model_version:string}).model_version) : null;
  const elig = run ? Number((run as {eligible_securities:number}).eligible_securities) : 0;
  const tot = run ? Number((run as {total_securities:number}).total_securities) : 0;
  const top = rows.find(r=> r.combined_alpha_score!=null)?.combined_alpha_score ?? null;
  const buys = rows.filter(r=> r.classification==='Buy Quant'||r.classification==='Strong Buy Quant').length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="BRVM · Quant — vitrine publique" title="Westbourse Combined Alpha" subtitle="Un score de 0 à 100 pour comparer toutes les actions BRVM. 5 piliers — valorisation, momentum, qualité bénéficiaire, solidité financière et dividende — puis une pénalité risque (max 25 pts) si garde-fous déclenchés." accent="gold" actions={runDate ? (<div className="flex flex-wrap gap-2"><StatPill tone="neutral">Màj {runDate}</StatPill><StatPill tone="gold">v{runVer}</StatPill><StatPill tone="emerald">{elig}/{tot} éligibles</StatPill></div>) : undefined} />
      <div className="gold-rule" />
      {!run ? <EmptyStatePremium icon="◈" title="Aucun calcul disponible" hint="Lancez un run via POST /api/admin/quant/run (admin)." /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Univers BRVM" value={String(tot)} unit="titres" accent="neutral" />
            <MetricCard label="Score calculable" value={String(elig)} unit="titres" accent="gold" />
            <MetricCard label="Signaux Achat quant" value={String(buys)} unit="titres" accent="emerald" />
            <MetricCard label="Meilleur score" value={top!=null?String(top):'—'} unit="/ 100" accent={top!=null&&top>=70?'emerald':'neutral'} />
          </div>
          <PremiumPanel className="overflow-hidden p-0">
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50">
              <Eyebrow>Classement Combined Alpha — {rows.length} titres</Eyebrow>
              <span className="text-xs text-faint">Tri décroissant · ticker → détail par pilier</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-elevated/60 text-[11px] tracking-wide text-faint"><tr>
                  <th className="px-3 py-2.5 text-left font-medium">Rang</th>
                  <th className="px-3 py-2.5 text-left font-medium">Ticker</th>
                  <th className="px-3 py-2.5 text-left font-medium">Société</th>
                  <th className="px-2 py-2.5 text-right font-medium">Combined</th>
                  <th className="px-2 py-2.5 text-right font-medium">Valo</th>
                  <th className="px-2 py-2.5 text-right font-medium">Momentum</th>
                  <th className="px-2 py-2.5 text-right font-medium">Qualité</th>
                  <th className="px-2 py-2.5 text-right font-medium">Solidité</th>
                  <th className="px-2 py-2.5 text-right font-medium">Dividende</th>
                  <th className="px-3 py-2.5 text-left font-medium">Signal</th>
                </tr></thead>

                <tbody className="divide-y divide-border/40">
                  {rows.map(r=> { const insuf = r.classification==='Insufficient Data'||r.combined_alpha_score==null; return (
                    <tr key={r.security_id} className={insuf?'bg-elevated/20 text-faint':'hover:bg-gold/[0.03] transition-colors'}>
                      <td className="px-3 py-2.5 tabular-nums text-xs">{r.rank_global ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs"><Link href={`/actions/${r.security_id}/quant`} className="text-sapphire hover:text-gold font-semibold hover:underline">{r.security_id}</Link></td>
                      <td className="px-3 py-2.5 max-w-[18rem] truncate text-xs text-muted">{labels[r.security_id] ?? r.security_id}</td>
                      <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${tone(r.combined_alpha_score)}`}>{r.combined_alpha_score ?? '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-xs">{r.value_score ?? '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-xs">{r.price_momentum_score ?? '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-xs">{r.earnings_quality_score ?? '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-xs">{r.financial_strength_score ?? '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-xs">{r.dividend_quality_score ?? '—'}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap ${signalCls(r.classification)}`}>{r.classification==='Insufficient Data'?'Données insuffisantes':r.classification}</span></td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-3 border-t border-border/50 text-xs text-faint">
              <span><span className="inline-block h-2 w-2 rounded-full bg-up mr-1.5" />Achat quant ≥ 65</span>
              <span><span className="inline-block h-2 w-2 rounded-full bg-warn mr-1.5" />Surveiller 50–64</span>
              <span><span className="inline-block h-2 w-2 rounded-full bg-down mr-1.5" />Éviter &lt; 50</span>
              <span className="ml-auto">{rows.filter(r=>r.confidence_level==='high').length} fiabilité élevée · {rows.filter(r=>r.confidence_level==='medium').length} moyenne</span>
            </div>
          </PremiumPanel>
          <div className="rounded-card border border-border bg-surface shadow-card p-5 space-y-4">
            <Eyebrow>Comment lire ce classement ?</Eyebrow>
            <div className="grid md:grid-cols-3 gap-4 text-xs leading-relaxed">
              <div><p className="font-semibold text-ivory">Le score Combined (0–100)</p><p className="text-muted mt-1">100 = excellent sur tous les piliers. 0 = très faible. Pastille : <span className="text-up font-medium">Achat quant</span> ≥65, <span className="text-warn font-medium">Surveiller</span> 50–64, <span className="text-down font-medium">Éviter</span> &lt;50. Filtre quantitatif, pas un conseil.</p></div>
              <div><p className="font-semibold text-ivory">Les 5 piliers</p><ul className="mt-1 space-y-1 text-muted"><li><span className="text-ivory font-medium">Valorisation 30%</span> — prix bon marché ?</li><li><span className="text-ivory font-medium">Momentum 25%</span> — tendance 3/6/12 mois</li><li><span className="text-ivory font-medium">Qualité 20%</span> — ROE & régularité</li><li><span className="text-ivory font-medium">Solidité 15%</span> — dette & trésorerie</li><li><span className="text-ivory font-medium">Dividende 10%</span> — rendement & régularité</li></ul></div>
              <div><p className="font-semibold text-ivory">Fiabilité & garde-fous</p><p className="text-muted mt-1">Pilier manquant → poids redistribué. Fiabilité faible bloque “Achat fort”. Pénalité risque ≤25 : capitaux négatifs, pertes, illiquidité. “Données insuffisantes” = non calculable.</p></div>
            </div>
          </div>
          <details className="rounded-card border border-border bg-elevated/40 px-5 py-4"><summary className="cursor-pointer text-sm font-medium text-ivory">Méthodologie détaillée</summary><div className="mt-3 text-xs leading-relaxed text-muted space-y-2"><p>Combined Alpha = 30% Value + 25% Momentum + 20% Quality + 15% Strength + 10% Dividend − pénalité risque (≤25). Momentum = 0,40×M12_1 + 0,25×M6M + 0,15×M3M + 0,10×52w + 0,10×tendance − pénalités liquidité/volatilité. Percentile sectoriel si ≥5 comparables sinon global, winsorisation 5–95%.</p><p className="text-faint italic">Score propriétaire Westbourse, indicatif, ne constitue pas un conseil. Compléter par fondamentaux et liquidité.</p></div></details>
        </>
      )}
    </div>
  );
}

