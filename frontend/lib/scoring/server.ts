import { createPublicClient } from '@/lib/supabase/public';
import { computeFScore, type FScoreYear, type FScoreResult } from './piotroski';
import { computeAltmanZ, type AltmanResult } from './altman';

export interface CompanyScoring {
  code: string;
  fscore: FScoreResult | null;
  altman: AltmanResult | null;
}

interface IncRow { code: string; periode: string; revenu_total: number | null; marge_brute: number | null; resultat_net: number | null; actions_en_circulation: number | null; resultat_exploitation: number | null; }
interface BalRow { code: string; periode: string; total_actifs: number | null; total_actif_circulant: number | null; passif_courant: number | null; dette_long_terme: number | null; reserves_benefices_non_repartis: number | null; total_capitaux_propres: number | null; }
interface CfRow { code: string; periode: string; flux_exploitation: number | null; }

function latestTwo<T extends { periode: string }>(rows: T[]): { curr: T | null; prev: T | null } {
  const sorted = [...rows].sort((a, b) => b.periode.localeCompare(a.periode));
  return { curr: sorted[0] ?? null, prev: sorted[1] ?? null };
}

function buildYear(inc: IncRow | null, bal: BalRow | null, cf: CfRow | null): FScoreYear {
  return {
    revenu_total: inc?.revenu_total ?? null,
    marge_brute: inc?.marge_brute ?? null,
    resultat_net: inc?.resultat_net ?? null,
    actions_en_circulation: inc?.actions_en_circulation ?? null,
    total_actifs: bal?.total_actifs ?? null,
    total_actif_circulant: bal?.total_actif_circulant ?? null,
    passif_courant: bal?.passif_courant ?? null,
    dette_long_terme: bal?.dette_long_terme ?? null,
    flux_exploitation: cf?.flux_exploitation ?? null,
  };
}

function compute(code: string, inc: IncRow[], bal: BalRow[], cf: CfRow[], famille: string | null): CompanyScoring {
  const i = latestTwo(inc), b = latestTwo(bal), c = latestTwo(cf);
  let fscore: FScoreResult | null = null;
  if (i.curr && i.prev && b.curr && b.prev) {
    fscore = computeFScore(buildYear(i.curr, b.curr, c.curr), buildYear(i.prev, b.prev, c.prev));
  }
  let altman: AltmanResult | null = null;
  if (b.curr) {
    altman = computeAltmanZ({
      total_actifs: b.curr.total_actifs,
      total_actif_circulant: b.curr.total_actif_circulant,
      passif_courant: b.curr.passif_courant,
      reserves_benefices_non_repartis: b.curr.reserves_benefices_non_repartis,
      resultat_exploitation: i.curr?.resultat_exploitation ?? null,
      total_capitaux_propres: b.curr.total_capitaux_propres,
      famille,
    });
  }
  return { code, fscore, altman };
}

const INC_SEL = 'code, periode, revenu_total, marge_brute, resultat_net, actions_en_circulation, resultat_exploitation';
const BAL_SEL = 'code, periode, total_actifs, total_actif_circulant, passif_courant, dette_long_terme, reserves_benefices_non_repartis, total_capitaux_propres';

/** Scoring d'une société (Piotroski + Altman). */
export async function getScoring(code: string): Promise<CompanyScoring> {
  const sb = createPublicClient();
  const [{ data: inc }, { data: bal }, { data: cf }, { data: instr }] = await Promise.all([
    sb.from('income_statements').select(INC_SEL).eq('code', code),
    sb.from('balance_sheets').select(BAL_SEL).eq('code', code),
    sb.from('cash_flow_statements').select('code, periode, flux_exploitation').eq('code', code),
    sb.from('brvm_instruments').select('famille_comptable').eq('code', code).maybeSingle(),
  ]);
  return compute(code, (inc ?? []) as IncRow[], (bal ?? []) as BalRow[], (cf ?? []) as CfRow[], (instr as { famille_comptable: string | null } | null)?.famille_comptable ?? null);
}

/** Scoring de tout le marché (pour le screener). */
export async function getMarketScoring(): Promise<Map<string, CompanyScoring>> {
  const sb = createPublicClient();
  const [{ data: inc }, { data: bal }, { data: cf }, { data: instr }] = await Promise.all([
    sb.from('income_statements').select(INC_SEL),
    sb.from('balance_sheets').select(BAL_SEL),
    sb.from('cash_flow_statements').select('code, periode, flux_exploitation'),
    sb.from('brvm_instruments').select('code, famille_comptable'),
  ]);
  const group = <T extends { code: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { if (!m.has(r.code)) m.set(r.code, []); m.get(r.code)!.push(r); }
    return m;
  };
  const incBy = group((inc ?? []) as IncRow[]);
  const balBy = group((bal ?? []) as BalRow[]);
  const cfBy = group((cf ?? []) as CfRow[]);
  const famBy = new Map<string, string | null>();
  for (const i of (instr ?? []) as { code: string; famille_comptable: string | null }[]) famBy.set(i.code, i.famille_comptable);

  const out = new Map<string, CompanyScoring>();
  for (const code of incBy.keys()) {
    out.set(code, compute(code, incBy.get(code) ?? [], balBy.get(code) ?? [], cfBy.get(code) ?? [], famBy.get(code) ?? null));
  }
  return out;
}
