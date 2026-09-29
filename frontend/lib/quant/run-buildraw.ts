import { dividendCAGR } from './dividend-quality';
function nNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : v != null && !isNaN(Number(v)) ? Number(v) : null;
}
export function buildRaw(a: {
  inc: Record<string,unknown>|null;
  incPrev: Record<string,unknown>|null;
  incHistory: Record<string,unknown>[];
  bal: Record<string,unknown>|null;
  cf: Record<string,unknown>|null;
  price:number|null; shares:number|null; divRows: Record<string,unknown>[];
}): Record<string,number|null> {
  const inc=a.inc as unknown as { revenu_total:number|null; resultat_net:number|null; benefice_par_action:number|null; dividende_par_action:number|null; resultat_exploitation:number|null; charges_financieres_nettes:number|null }|null;
  const bal=a.bal as unknown as { total_capitaux_propres:number|null; total_actifs:number|null; dette_court_terme:number|null; dette_long_terme:number|null; total_actif_circulant:number|null; passif_courant:number|null; tresorerie_equivalents:number|null; lignes_specifiques:Record<string,number|null>|null }|null;
  const cf=a.cf as unknown as { flux_exploitation:number|null; flux_tresorerie_disponible:number|null; depreciation_amortissement:number|null }|null;
  const bpa=nNum(inc?.benefice_par_action); const dpa=nNum(inc?.dividende_par_action);
  const rn=nNum(inc?.resultat_net); const cap=nNum(bal?.total_capitaux_propres);
  const ebit=nNum(inc?.resultat_exploitation); const dep=nNum(cf?.depreciation_amortissement);
  const ebitda=ebit!=null&&dep!=null?ebit+dep:ebit;
  const per=bpa!=null&&bpa>0&&a.price!=null&&a.price>0?a.price/bpa:null;
  const mc=a.price!=null&&a.shares!=null&&a.shares>0?a.price*a.shares:null;
  const pb=mc!=null&&cap!=null&&cap>0?mc/cap:null;
  const dy=dpa!=null&&a.price!=null&&a.price>0?dpa/a.price:null;
  const dct=nNum(bal?.dette_court_terme)??0; const dlt=nNum(bal?.dette_long_terme)??0;
  const hasD=nNum(bal?.dette_court_terme)!=null||nNum(bal?.dette_long_terme)!=null;
  const dTot=hasD?dct+dlt:null; const cash=nNum(bal?.tresorerie_equivalents);
  const ev=mc!=null&&dTot!=null?mc+dTot-(cash??0):null;
  const evEbitda=ev!=null&&ebitda!=null&&ebitda!==0?ev/ebitda:null;
  const ey=per!=null&&per!==0?1/per:null;
  const roe=rn!=null&&cap!=null&&cap!==0?rn/cap:null;
  const roa=rn!=null&&nNum(bal?.total_actifs)!=null&&nNum(bal?.total_actifs)!==0?rn!/nNum(bal?.total_actifs)!:null;
  let eps3:number|null=null;
  if(a.incHistory.length>=4){
    const s=[...a.incHistory].sort((x,y)=>String(x.periode).localeCompare(String(y.periode)));
    const lo=nNum(s[s.length-1]?.benefice_par_action); const fi=nNum(s[s.length-4]?.benefice_par_action);
    if(lo!=null&&fi!=null&&fi>0&&lo>0) eps3=Math.pow(lo/fi,1/3)-1;
  }
  const prev=nNum(a.incPrev?.resultat_net);
  const nig=rn!=null&&prev!=null&&prev!==0?(rn-prev)/Math.abs(prev):null;
  const fex=nNum(cf?.flux_exploitation); const cc=fex!=null&&rn!=null&&rn!==0?fex/rn:null;
  const acc=rn!=null&&fex!=null&&nNum(bal?.total_actifs)!=null&&nNum(bal?.total_actifs)!==0?(rn-fex)/nNum(bal?.total_actifs)!:null;
  let ms:number|null=null; let es2:number|null=null;
  if(a.incHistory.length>=3){
    const s=[...a.incHistory].sort((x,y)=>String(x.periode).localeCompare(String(y.periode))).slice(-3);
    const ms2=s.map(r=>{const aa=nNum((r as Record<string,unknown>).resultat_net);const bb=nNum((r as Record<string,unknown>).revenu_total);if(aa==null||bb==null||bb===0)return null;return aa/bb;}).filter((v):v is number=>v!=null);
    if(ms2.length>=3){const m=ms2.reduce((a2,b)=>a2+b,0)/ms2.length;const sd=Math.sqrt(ms2.reduce((si,x)=>si+(x-m)**2,0)/(ms2.length-1));ms=sd===0?100:Math.max(0,100-sd*500);const nets=s.map(r=>nNum((r as Record<string,unknown>).resultat_net)).filter((v):v is number=>v!=null);if(nets.length>=3){const mn=nets.reduce((a2,b)=>a2+b,0)/nets.length;const sdn=Math.sqrt(nets.reduce((si,x)=>si+(x-mn)**2,0)/(nets.length-1));const cv=Math.abs(mn)>0?sdn/Math.abs(mn):10;es2=Math.max(0,100-cv*50);}}
  }
  const ic=ebit!=null&&nNum(inc?.charges_financieres_nettes)!=null&&nNum(inc?.charges_financieres_nettes)!==0?ebit/Math.abs(nNum(inc?.charges_financieres_nettes)!):null;
  const ndE=dTot!=null&&cash!=null&&ebitda!=null&&ebitda!==0?(dTot-cash)/ebitda:null;
  const de=dTot!=null&&cap!=null&&cap!==0?dTot/cap:null;
  const cr=nNum(bal?.total_actif_circulant)!=null&&nNum(bal?.passif_courant)!=null&&nNum(bal?.passif_courant)!==0?nNum(bal?.total_actif_circulant)!/nNum(bal?.passif_courant)!:null;
  const fcf=nNum(cf?.flux_tresorerie_disponible); const fcfD=fcf!=null&&dTot!=null&&dTot!==0?fcf/dTot:null;
  const ls=(bal?.lignes_specifiques??{}) as Record<string,number|null>; const car=nNum(ls.ratio_solvabilite)??null;
  let dc:number|null=null; let dg:number|null=null;
  if(a.divRows.length>0){const paid=a.divRows.filter(r=>nNum((r as Record<string,unknown>).montant)!=null&&nNum((r as Record<string,unknown>).montant)!>0).length;dc=Math.round((paid/Math.min(5,a.divRows.length))*100);const vals=[...a.divRows].sort((x,y)=>String(x.exercice).localeCompare(String(y.exercice))).map(r=>nNum((r as Record<string,unknown>).montant)).filter((v):v is number=>v!=null&&v>0);if(vals.length>=2)dg=dividendCAGR(vals);}
  const pay=(()=>{if(dpa==null||rn==null||rn===0) return null; if(a.shares!=null&&a.shares>0) return (dpa*a.shares)/rn*100; if(bpa!=null&&bpa!==0) return (dpa/bpa)*100; return null;})();
  return { per,pb,dividendYield:dy,evEbitda,earningsYield:ey,roe,roa,epsGrowth3y:eps3,netIncomeGrowth:nig,marginStability:ms,cashConversion:cc,accruals:acc,earningsStability:es2,interestCoverage:ic,netDebtToEbitda:ndE,debtToEquity:de,currentRatio:cr,fcfToDebt:fcfD,capitalAdequacy:car,liquidityRatio:cr,solvencyRatio:car,combinedRatio:nNum(ls.ratio_combine),dividendConsistency:dc,dividendGrowth:dg,payoutRatio:pay,_metaRn:rn,_metaCapitaux:cap } as unknown as Record<string,number|null>;
}
