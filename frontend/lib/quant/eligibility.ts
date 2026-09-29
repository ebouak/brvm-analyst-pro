import type { EligibilityStatus, ConfidenceLevel } from './types';
export function assessEligibility(params: {
  isSuspended?: boolean;
  hasClose?: boolean;
  hasHistory?: boolean;
  hasRecentFinancials?: boolean;
  yearsOfFinancials?: number;
  tradingDays90?: number | null;
  liquidityScore?: number | null;
  coverageRate?: number;
}): { status: EligibilityStatus; confidence: ConfidenceLevel; reasons: string[] } {
  const reasons:string[]=[];
  if(params.isSuspended){ reasons.push('Titre suspendu'); return {status:'ineligible',confidence:'insufficient',reasons}; }
  if(!params.hasClose){ reasons.push('Cours de clôture manquant'); return {status:'ineligible',confidence:'insufficient',reasons}; }
  if(!params.hasHistory){ reasons.push('Historique insuffisant'); return {status:'ineligible',confidence:'insufficient',reasons}; }
  if(!params.hasRecentFinancials){ reasons.push('États financiers récents manquants'); return {status:'ineligible',confidence:'insufficient',reasons}; }
  if((params.yearsOfFinancials??0)<1){ reasons.push('Au moins 1 an requis'); return {status:'ineligible',confidence:'insufficient',reasons}; }
  if(params.tradingDays90!=null && params.tradingDays90<20){ reasons.push('<20 séances/90j'); return {status:'ineligible',confidence:'insufficient',reasons}; }
  // warnings
  let status: EligibilityStatus='eligible';
  if((params.yearsOfFinancials??0)<3){ reasons.push('<3 ans de données'); status='eligible_with_warning'; }
  if(params.liquidityScore!=null && params.liquidityScore<30){ reasons.push('Liquidité très faible'); status='eligible_with_warning'; }
  if((params.coverageRate??1)<0.6){ reasons.push('Couverture données <60%'); status='eligible_with_warning'; }
  const confidence: ConfidenceLevel = status==='eligible_with_warning' ? 'low' : (params.coverageRate??1)>=0.85 ? 'high':'medium';
  return {status,confidence,reasons};
}
