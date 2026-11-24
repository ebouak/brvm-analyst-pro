import type { SaBalanceYear, SaCashFlowYear, SaCompanyProfile, SaDividendRow, SaIncomeYear } from './parse.js';

export interface WbIncomeRow {
  code: string;
  periode: string;
  type_periode: string;
  revenu_total: number | null;
  resultat_exploitation: number | null;
  resultat_avant_impots: number | null;
  impots: number | null;
  resultat_net: number | null;
  benefice_par_action: number | null;
  actions_en_circulation: number | null;
  dividende_par_action: number | null;
}

export interface WbBalanceRow {
  code: string;
  periode: string;
  type_periode: string;
  total_actifs: number | null;
  tresorerie_equivalents: number | null;
  investissements_court_terme: number | null;
  creances_clients: number | null;
  stocks: number | null;
  immobilisations_nettes: number | null;
  goodwill: number | null;
  actifs_incorporels: number | null;
  total_passif: number | null;
  fournisseurs: number | null;
  dette_court_terme: number | null;
  dette_long_terme: number | null;
  total_capitaux_propres: number | null;
  capital_social: number | null;
  reserves_benefices_non_repartis: number | null;
}

export interface WbCashFlowRow {
  code: string;
  periode: string;
  type_periode: string;
  flux_exploitation: number | null;
  resultat_net: number | null;
  depreciation_amortissement: number | null;
  flux_investissement: number | null;
  depenses_capital: number | null;
  flux_financement: number | null;
  dividendes_verses: number | null;
  flux_tresorerie_disponible: number | null;
}

export interface Discrepancy {
  code: string;
  category: 'income' | 'balance' | 'cashflow' | 'dividend' | 'profile';
  year?: number;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface EnrichmentPlan {
  code: string;
  incomeUpserts: Array<Partial<WbIncomeRow> & { code: string; periode: string; type_periode: 'annuel' }>;
  balanceUpserts: Array<Partial<WbBalanceRow> & { code: string; periode: string; type_periode: 'annuel' }>;
  cashFlowUpserts: Array<Partial<WbCashFlowRow> & { code: string; periode: string; type_periode: 'annuel' }>;
  discrepancies: Discrepancy[];
  fieldsFilled: number;
}

function pctDiff(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom;
}

export function planEnrichment(params: {
  code: string;
  famille: string | null;
  wbIncome: WbIncomeRow[];
  wbBalance: WbBalanceRow[];
  wbCashFlow: WbCashFlowRow[];
  wbHasDirigeants: boolean;
  wbLatestDividendExDate: string | null;
  wbLatestDividendGrossOrNet: number | null;
  saIncome: SaIncomeYear[];
  saBalance: SaBalanceYear[];
  saCashFlow: SaCashFlowYear[];
  saProfile: SaCompanyProfile | null;
  saDividends: SaDividendRow[];
}): EnrichmentPlan {
  const { code, famille } = params;
  const isBank = famille === 'banque';
  const discrepancies: Discrepancy[] = [];
  const incomeUpserts: EnrichmentPlan['incomeUpserts'] = [];
  const balanceUpserts: EnrichmentPlan['balanceUpserts'] = [];
  const cashFlowUpserts: EnrichmentPlan['cashFlowUpserts'] = [];
  let fieldsFilled = 0;

  const incByYear = new Map(
    params.wbIncome.filter((r) => r.type_periode === 'annuel').map((r) => [r.periode, r]),
  );
  const balByYear = new Map(
    params.wbBalance.filter((r) => r.type_periode === 'annuel').map((r) => [r.periode, r]),
  );
  const cfByYear = new Map(
    params.wbCashFlow.filter((r) => r.type_periode === 'annuel').map((r) => [r.periode, r]),
  );

  // Detect internal WestBourse collision on consecutive years (e.g. NSBC 2022/2023)
  const yearsSorted = [...incByYear.keys()].sort();
  for (let i = 1; i < yearsSorted.length; i++) {
    const prev = incByYear.get(yearsSorted[i - 1]!)!;
    const curr = incByYear.get(yearsSorted[i]!)!;
    if (
      prev.resultat_avant_impots != null &&
      curr.resultat_avant_impots != null &&
      prev.resultat_avant_impots === curr.resultat_avant_impots &&
      prev.impots != null &&
      curr.impots === prev.impots &&
      prev.resultat_net !== curr.resultat_net
    ) {
      discrepancies.push({
        code,
        category: 'income',
        year: Number(curr.periode),
        severity: 'error',
        message: `Collision interne probable sur ${curr.periode} vs ${prev.periode} : resultat_avant_impots (${curr.resultat_avant_impots}) et impots (${curr.impots}) identiques alors que resultat_net diffère.`,
      });
    }
  }

  // 1. Income statements (only fill null fields; never overwrite bank PNB)
  for (const sa of params.saIncome) {
    if (sa.year < 2021) continue;
    const periode = String(sa.year);
    const wb = incByYear.get(periode);

    if (!wb) {
      if (sa.revenue == null && sa.netIncome == null) continue;
      const row: EnrichmentPlan['incomeUpserts'][number] = {
        code,
        periode,
        type_periode: 'annuel',
        revenu_total: sa.revenue,
        resultat_exploitation: isBank ? null : sa.operatingIncome,
        resultat_avant_impots: sa.pretaxIncome,
        impots: sa.incomeTax,
        resultat_net: sa.netIncome,
        benefice_par_action: sa.eps,
        actions_en_circulation: sa.shares,
        dividende_par_action: sa.dividendPerShare,
      };
      incomeUpserts.push(row);
      fieldsFilled += Object.values(row).filter((v) => v !== null && v !== code && v !== periode && v !== 'annuel').length;
      continue;
    }

    // Cross-check existing values
    if (wb.revenu_total != null && sa.revenue != null && pctDiff(wb.revenu_total, sa.revenue) > 0.03) {
      discrepancies.push({
        code,
        category: 'income',
        year: sa.year,
        severity: isBank ? 'info' : 'warn',
        message: isBank
          ? `Écart PNB (${periode}) : WestBourse=${wb.revenu_total} vs S&P=${sa.revenue} (S&P déduit souvent le coût du risque du PNB — PNB WestBourse conservé).`
          : `Écart Revenu (${periode}) : WestBourse=${wb.revenu_total} vs S&P=${sa.revenue}.`,
      });
    }
    if (wb.resultat_net != null && sa.netIncome != null && pctDiff(wb.resultat_net, sa.netIncome) > 0.03) {
      discrepancies.push({
        code,
        category: 'income',
        year: sa.year,
        severity: 'warn',
        message: `Écart Résultat net (${periode}) : WestBourse=${wb.resultat_net} vs S&P=${sa.netIncome}.`,
      });
    }

    const patch: EnrichmentPlan['incomeUpserts'][number] = { code, periode, type_periode: 'annuel' };
    let added = 0;
    if (wb.revenu_total == null && sa.revenue != null) {
      patch.revenu_total = sa.revenue;
      added++;
    }
    if (wb.resultat_exploitation == null && !isBank && sa.operatingIncome != null) {
      patch.resultat_exploitation = sa.operatingIncome;
      added++;
    }
    if (wb.resultat_avant_impots == null && sa.pretaxIncome != null) {
      patch.resultat_avant_impots = sa.pretaxIncome;
      added++;
    }
    if (wb.impots == null && sa.incomeTax != null) {
      patch.impots = sa.incomeTax;
      added++;
    }
    if (wb.resultat_net == null && sa.netIncome != null) {
      patch.resultat_net = sa.netIncome;
      added++;
    }
    if (wb.benefice_par_action == null && sa.eps != null) {
      patch.benefice_par_action = sa.eps;
      added++;
    }
    if (wb.actions_en_circulation == null && sa.shares != null) {
      patch.actions_en_circulation = sa.shares;
      added++;
    }
    if (wb.dividende_par_action == null && sa.dividendPerShare != null) {
      patch.dividende_par_action = sa.dividendPerShare;
      added++;
    }
    if (added > 0) {
      incomeUpserts.push(patch);
      fieldsFilled += added;
    }
  }

  // 2. Balance sheets (only fill null fields; validate totalAssets >= equity when both present)
  for (const sa of params.saBalance) {
    if (sa.year < 2021) continue;
    if (sa.totalAssets != null && sa.equity != null && sa.totalAssets < sa.equity) {
      discrepancies.push({
        code,
        category: 'balance',
        year: sa.year,
        severity: 'error',
        message: `Bilan StockAnalysis incohérent (${sa.year}) : totalAssets (${sa.totalAssets}) < equity (${sa.equity}) — ignoré.`,
      });
      continue;
    }
    const periode = String(sa.year);
    const wb = balByYear.get(periode);

    const candidateFields: Array<[keyof WbBalanceRow, number | null]> = [
      ['total_actifs', sa.totalAssets],
      ['tresorerie_equivalents', sa.cash],
      ['investissements_court_terme', sa.shortTermInvestments],
      ['creances_clients', sa.receivables],
      ['stocks', sa.inventory],
      ['immobilisations_nettes', sa.ppe],
      ['goodwill', sa.goodwill],
      ['actifs_incorporels', sa.intangibles],
      ['total_passif', sa.totalLiabilities],
      ['fournisseurs', sa.accountsPayable],
      ['dette_court_terme', sa.shortTermDebt],
      ['dette_long_terme', sa.longTermDebt],
      ['total_capitaux_propres', sa.equity],
      ['capital_social', sa.commonStock],
      ['reserves_benefices_non_repartis', sa.retainedEarnings],
    ];

    if (!wb) {
      if (sa.totalAssets == null && sa.equity == null) continue;
      const row: Record<string, unknown> = { code, periode, type_periode: 'annuel' };
      let added = 0;
      for (const [k, v] of candidateFields) {
        if (v != null) {
          row[k] = v;
          added++;
        }
      }
      if (added > 0) {
        balanceUpserts.push(row as EnrichmentPlan['balanceUpserts'][number]);
        fieldsFilled += added;
      }
      continue;
    }

    const patch: Record<string, unknown> = { code, periode, type_periode: 'annuel' };
    let added = 0;
    for (const [k, v] of candidateFields) {
      if (wb[k] == null && v != null) {
        patch[k] = v;
        added++;
      }
    }
    if (added > 0) {
      balanceUpserts.push(patch as EnrichmentPlan['balanceUpserts'][number]);
      fieldsFilled += added;
    }
  }

  // 3. Cash flow statements (only fill null fields; also compute FCF on existing rows)
  for (const sa of params.saCashFlow) {
    if (sa.year < 2021) continue;
    const periode = String(sa.year);
    const wb = cfByYear.get(periode);
    const candidateFields: Array<[keyof WbCashFlowRow, number | null]> = [
      ['flux_exploitation', sa.operatingCashFlow],
      ['depreciation_amortissement', sa.depreciationAmortization],
      ['flux_investissement', sa.investingCashFlow],
      ['depenses_capital', sa.capex],
      ['flux_financement', sa.financingCashFlow],
      ['dividendes_verses', sa.dividendsPaid],
      ['flux_tresorerie_disponible', sa.freeCashFlow],
    ];

    if (!wb) {
      const hasAny = candidateFields.some(([, v]) => v != null);
      if (!hasAny) continue;
      const row: Record<string, unknown> = { code, periode, type_periode: 'annuel' };
      let added = 0;
      for (const [k, v] of candidateFields) {
        if (v != null) {
          row[k] = v;
          added++;
        }
      }
      if (added > 0) {
        cashFlowUpserts.push(row as EnrichmentPlan['cashFlowUpserts'][number]);
        fieldsFilled += added;
      }
      continue;
    }

    const patch: Record<string, unknown> = { code, periode, type_periode: 'annuel' };
    let added = 0;
    for (const [k, v] of candidateFields) {
      if (wb[k] == null && v != null) {
        patch[k] = v;
        added++;
      }
    }
    // Derive FCF locally if WestBourse already had CFO & Capex
    if (
      patch.flux_tresorerie_disponible == null &&
      wb.flux_tresorerie_disponible == null &&
      wb.flux_exploitation != null &&
      wb.depenses_capital != null
    ) {
      patch.flux_tresorerie_disponible = wb.flux_exploitation - Math.abs(wb.depenses_capital);
      added++;
    }
    if (added > 0) {
      cashFlowUpserts.push(patch as EnrichmentPlan['cashFlowUpserts'][number]);
      fieldsFilled += added;
    }
  }

  // Also check existing WestBourse cash flow rows even if StockAnalysis had no CF table (e.g., FCF derivation)
  for (const wb of cfByYear.values()) {
    const alreadyPatched = cashFlowUpserts.some((p) => p.periode === wb.periode);
    if (!alreadyPatched && wb.flux_tresorerie_disponible == null && wb.flux_exploitation != null && wb.depenses_capital != null) {
      cashFlowUpserts.push({
        code,
        periode: wb.periode,
        type_periode: 'annuel',
        flux_tresorerie_disponible: wb.flux_exploitation - Math.abs(wb.depenses_capital),
      });
      fieldsFilled++;
    }
  }

  // 4. Profile & dividend cross-check (never auto-overwrite societes_profils.dirigeants without official source)
  if (!params.wbHasDirigeants && params.saProfile && params.saProfile.executives.length > 0) {
    discrepancies.push({
      code,
      category: 'profile',
      severity: 'info',
      message: `Dirigeants absents de societes_profils (S&P liste ${params.saProfile.executives.map((e) => `${e.name} [${e.position}]`).join(', ')}) — à confirmer sur source officielle BRVM/émetteur.`,
    });
  }

  if (params.wbLatestDividendExDate && params.saDividends.length > 0) {
    const saMatch = params.saDividends.find((d) => d.exDate === params.wbLatestDividendExDate);
    if (!saMatch) {
      discrepancies.push({
        code,
        category: 'dividend',
        severity: 'info',
        message: `Dernier ex-date BRVM (${params.wbLatestDividendExDate}) absent de StockAnalysis.`,
      });
    } else if (
      params.wbLatestDividendGrossOrNet != null &&
      saMatch.amount != null &&
      pctDiff(params.wbLatestDividendGrossOrNet, saMatch.amount) > 0.15
    ) {
      discrepancies.push({
        code,
        category: 'dividend',
        severity: 'warn',
        message: `Écart dividende (${params.wbLatestDividendExDate}) : WestBourse=${params.wbLatestDividendGrossOrNet} vs StockAnalysis=${saMatch.amount} (BRVM officiel conservé).`,
      });
    }
  }

  return {
    code,
    incomeUpserts,
    balanceUpserts,
    cashFlowUpserts,
    discrepancies,
    fieldsFilled,
  };
}
