import { calculatePercentile } from './normalization';
import { isFiniteNumber, clamp } from './math';
import type { Sector, FactorScore } from './types';

export interface ValueInputs {
  sector: Sector;
  per: number | null;
  pb: number | null;
  dividendYield: number | null;
  evEbitda: number | null;
  earningsYield: number | null;
  roe?: number | null;
  netIncome?: number | null;
  ebitda?: number | null;
  payoutRatio?: number | null;
  isExceptionalDividend?: boolean;
  // universe peers
  peers: {
    per: (number | null)[];
    pb: (number | null)[];
    divYield: (number | null)[];
    evEbitda: (number | null)[];
    earningsYield: (number | null)[];
    roe: (number | null)[];
  };
  sectorPeers?: {
    per: (number | null)[];
    pb: (number | null)[];
    divYield: (number | null)[];
    evEbitda: (number | null)[];
    earningsYield: (number | null)[];
  };
}

function pct(v: number | null, arr: (number | null)[], higherIsBetter: boolean): number | null {
  return calculatePercentile(v, arr, higherIsBetter);
}

export function computeValueScore(inp: ValueInputs): { score: number | null; factors: Record<string, FactorScore>; notes: string[]; penalty: number } {
  const notes: string[] = [];
  const isBank = inp.sector === 'banks';
  const isInsurance = inp.sector === 'insurance';

  // Sanitize: if netIncome <=0, PER/EY not favorable
  let per = inp.per, ey = inp.earningsYield;
  if (inp.netIncome != null && inp.netIncome <= 0) { per = null; ey = null; notes.push('Bénéfice <=0: PER/EY neutralisés'); }
  let evEbitda = inp.evEbitda;
  if (inp.ebitda != null && inp.ebitda <= 0) { evEbitda = null; notes.push('EBITDA <=0: EV/EBITDA indisponible'); }
  let divYield = inp.dividendYield;
  if (inp.isExceptionalDividend) { divYield = null; notes.push('Dividende exceptionnel exclu'); }
  if (inp.payoutRatio != null && inp.payoutRatio > 100 && divYield != null) {
    // cap dividend yield score later via penalty
    notes.push('Payout >100%: dividende pénalisé');
  }

  const useSector = (k: keyof ValueInputs['peers']): (number | null)[] => {
    const sp = (inp.sectorPeers as Record<string,(number|null)[]> | undefined)?.[k];
    if (sp && (sp as (number|null)[]).filter((v) => v != null && isFiniteNumber(v as number)).length >= 5) return sp as (number|null)[];
    return inp.peers[k];
  };

  let factors: Record<string, FactorScore> = {};
  let penalty = 0;
  if (inp.payoutRatio != null && inp.payoutRatio > 120) penalty += 5;

  if (isBank) {
    const pbPct = pct(inp.pb, useSector('pb'), false);
    const perPct = pct(per, useSector('per'), false);
    const dyPct = pct(divYield, useSector('divYield'), true);
    const roeAdjPct = pct(inp.roe ?? null, useSector('roe'), true);
    factors = {
      pb: { value: inp.pb, percentile: pbPct, weight: 0.45, weightedScore: pbPct != null ? pbPct * 0.45 : null, source: 'P/B', notes: [] },
      per: { value: per, percentile: perPct, weight: 0.25, weightedScore: perPct != null ? perPct * 0.25 : null, source: 'PER', notes: [] },
      divYield: { value: divYield, percentile: dyPct, weight: 0.20, weightedScore: dyPct != null ? dyPct * 0.20 : null, source: 'Yield', notes: [] },
      roeAdj: { value: inp.roe ?? null, percentile: roeAdjPct, weight: 0.10, weightedScore: roeAdjPct != null ? roeAdjPct * 0.10 : null, source: 'ROE', notes: [] },
    };
  } else if (isInsurance) {
    const pbPct = pct(inp.pb, useSector('pb'), false);
    const perPct = pct(per, useSector('per'), false);
    const dyPct = pct(divYield, useSector('divYield'), true);
    const roeAdjPct = pct(inp.roe ?? null, useSector('roe'), true);
    factors = {
      pb: { value: inp.pb, percentile: pbPct, weight: 0.40, weightedScore: pbPct != null ? pbPct * 0.40 : null, source: 'P/B', notes: [] },
      per: { value: per, percentile: perPct, weight: 0.25, weightedScore: perPct != null ? perPct * 0.25 : null, source: 'PER', notes: [] },
      divYield: { value: divYield, percentile: dyPct, weight: 0.20, weightedScore: dyPct != null ? dyPct * 0.20 : null, source: 'Yield', notes: [] },
      roeAdj: { value: inp.roe ?? null, percentile: roeAdjPct, weight: 0.15, weightedScore: roeAdjPct != null ? roeAdjPct * 0.15 : null, source: 'ROE', notes: [] },
    };
  } else {
    const perPct = pct(per, useSector('per'), false);
    const pbPct = pct(inp.pb, useSector('pb'), false);
    const dyPct = pct(divYield, useSector('divYield'), true);
    const evPct = pct(evEbitda, useSector('evEbitda'), false);
    const eyPct = pct(ey, useSector('earningsYield'), true);
    // limit div yield if payout >100
    let dyScore = dyPct;
    if (inp.payoutRatio != null && inp.payoutRatio > 100 && dyScore != null) dyScore = Math.round(dyScore * 0.6);
    factors = {
      per: { value: per, percentile: perPct, weight: 0.30, weightedScore: perPct != null ? perPct * 0.30 : null, source: 'PER', notes: [] },
      pb: { value: inp.pb, percentile: pbPct, weight: 0.25, weightedScore: pbPct != null ? pbPct * 0.25 : null, source: 'P/B', notes: [] },
      divYield: { value: divYield, percentile: dyScore, weight: 0.20, weightedScore: dyScore != null ? dyScore * 0.20 : null, source: 'Yield', notes: [] },
      evEbitda: { value: evEbitda, percentile: evPct, weight: 0.15, weightedScore: evPct != null ? evPct * 0.15 : null, source: 'EV/EBITDA', notes: [] },
      earningsYield: { value: ey, percentile: eyPct, weight: 0.10, weightedScore: eyPct != null ? eyPct * 0.10 : null, source: 'EY', notes: [] },
    };
  }

  const avail = Object.values(factors).filter((f) => f.percentile != null) as FactorScore[];
  if (avail.length === 0) return { score: null, factors, notes, penalty };
  const wSum = avail.reduce((a, f) => a + f.weight, 0);
  const sum = avail.reduce((a, f) => a + (f.percentile! * (f.weight / wSum)), 0);
  let score = Math.round(sum);
  if (avail.length < Object.keys(factors).length) notes.push(`ValueScore sur ${avail.length}/${Object.keys(factors).length} facteurs`);
  score = clamp(score - penalty, 0, 100);
  return { score, factors, notes, penalty };
}
