import type { QuantScoreResult } from './types';
import { LEGAL_NOTICE } from './types';
export function explainCombinedAlpha(r: QuantScoreResult, pillars: { value:number|null; momentum:number|null; quality:number|null; strength:number|null; dividend:number|null }): string {
  const parts:string[]=[];
  parts.push(`Le score Combined Alpha de ${r.symbol} est de ${r.score ?? '—'}/100, classé ${r.classification}.`);
  const strengths: string[]=[];
  if((pillars.momentum??0)>=65) strengths.push('momentum de prix élevé');
  if((pillars.value??0)>=65) strengths.push('valorisation relativement attractive');
  if((pillars.quality??0)>=65) strengths.push('qualité des bénéfices solide');
  if((pillars.strength??0)>=65) strengths.push('structure financière robuste');
  if((pillars.dividend??0)>=65) strengths.push('profil de dividende favorable');
  if(strengths.length>0) parts.push(`Le titre se distingue par ${strengths.join(', ')}.`);
  if(r.penalties.length>0){
    const pen = r.penalties.map((p)=>`${p.label} (-${p.points})`).join(', ');
    parts.push(`Le score est pénalisé de ${r.penalties.reduce((a,p)=>a+p.points,0)} points: ${pen}.`);
  }
  parts.push(`Couverture données ${Math.round(r.dataCoverage.coverageRate*100)}% — fiabilité ${r.confidenceLevel}.`);
  parts.push('Signal quantitatif à compléter par une analyse fondamentale et une vérification de liquidité. ' + LEGAL_NOTICE);
  return parts.join(' ');
}
export function explainMomentum(r: QuantScoreResult): string {
  return `Momentum ${r.symbol}: ${r.score ?? '—'}/100 — ${r.classification}. ${LEGAL_NOTICE}`;
}
