import { describe, expect, it } from 'vitest';
import {
  parseStockAnalysisBalance,
  parseStockAnalysisCashFlow,
  parseStockAnalysisCompany,
  parseStockAnalysisDividends,
  parseStockAnalysisIncome,
} from '../src/stockanalysis/parse.js';
import { planEnrichment } from '../src/stockanalysis/compare.js';

const INCOME_HTML = `
<html><body>
<p>Financials in millions XOF. Fiscal year is January - December.</p>
<table>
  <thead><tr><th>Fiscal Year</th><th>TTM</th><th>FY 2025</th><th>FY 2024</th></tr></thead>
  <tbody>
    <tr><td>Revenue</td><td>100,934</td><td>104,793</td><td>98,638</td></tr>
    <tr><td>Pretax Income</td><td>35,490</td><td>43,146</td><td>40,219</td></tr>
    <tr><td>Income Tax Expense</td><td>1,427</td><td>2,434</td><td>2,107</td></tr>
    <tr><td>Net Income</td><td>34,063</td><td>40,712</td><td>38,112</td></tr>
    <tr><td>Basic Shares Outstanding</td><td>-</td><td>24.73</td><td>24.73</td></tr>
    <tr><td>EPS (Basic)</td><td>-</td><td>1645.96</td><td>1540.84</td></tr>
  </tbody>
</table>
</body></html>`;

const BALANCE_HTML = `
<html><body>
<p>Millions XOF. Fiscal year is Jan - Dec.</p>
<table>
  <thead><tr><th>Fiscal Year</th><th>FY 2025</th><th>FY 2024</th></tr></thead>
  <tbody>
    <tr><td>Cash &amp; Equivalents</td><td>235,374</td><td>128,185</td></tr>
    <tr><td>Investment Securities</td><td>586,072</td><td>550,315</td></tr>
    <tr><td>Gross Loans</td><td>1,821,475</td><td>1,538,825</td></tr>
    <tr><td>Property, Plant &amp; Equipment</td><td>132,733</td><td>107,287</td></tr>
    <tr><td>Other Intangible Assets</td><td>6,842</td><td>6,224</td></tr>
    <tr><td>Total Assets</td><td>3,073,062</td><td>2,514,388</td></tr>
    <tr><td>Long-Term Debt</td><td>40,117</td><td>18,740</td></tr>
    <tr><td>Total Liabilities</td><td>2,839,759</td><td>2,299,058</td></tr>
    <tr><td>Common Stock</td><td>24,735</td><td>24,735</td></tr>
    <tr><td>Additional Paid-In Capital</td><td>29,992</td><td>29,992</td></tr>
    <tr><td>Retained Earnings</td><td>178,576</td><td>160,603</td></tr>
    <tr><td>Shareholders' Equity</td><td>233,303</td><td>215,330</td></tr>
  </tbody>
</table>
</body></html>`;

const CF_HTML = `
<html><body>
<p>Millions XOF.</p>
<table>
  <thead><tr><th>Fiscal Year</th><th>FY 2025</th></tr></thead>
  <tbody>
    <tr><td>Operating Cash Flow</td><td>50,000</td></tr>
    <tr><td>Depreciation &amp; Amortization</td><td>4,500</td></tr>
    <tr><td>Capital Expenditures</td><td>-12,000</td></tr>
    <tr><td>Dividends Paid</td><td>-15,000</td></tr>
  </tbody>
</table>
</body></html>`;

const COMPANY_HTML = `
<html><body>
  <div>Founded 1906</div>
  <div>Employees 1,076</div>
  <div>ISIN Number CI0000002416</div>
  <table>
    <thead><tr><th>Name</th><th>Position</th></tr></thead>
    <tbody>
      <tr><td>Léonce Yace</td><td>Chief Executive Officer</td></tr>
      <tr><td>Max-Alphee Djecketh</td><td>Chief Financial Officer</td></tr>
    </tbody>
  </table>
</body></html>`;

const DIV_HTML = `
<html><body>
<table>
  <thead><tr><th>Ex-Dividend Date</th><th>Cash Amount</th><th>Record Date</th><th>Pay Date</th></tr></thead>
  <tbody>
    <tr><td>Aug 3, 2026</td><td>768.160 XOF</td><td>Aug 4, 2026</td><td>Aug 4, 2026</td></tr>
  </tbody>
</table>
</body></html>`;

describe('stockanalysis parsers', () => {
  it('parses income statement with Millions XOF scaling', () => {
    const res = parseStockAnalysisIncome(INCOME_HTML);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      year: 2025,
      revenue: 104_793_000_000,
      pretaxIncome: 43_146_000_000,
      incomeTax: 2_434_000_000,
      netIncome: 40_712_000_000,
      eps: 1645.96,
      shares: 24_730_000,
    });
  });

  it('parses balance sheet and combines common stock + APIC', () => {
    const res = parseStockAnalysisBalance(BALANCE_HTML);
    expect(res[0]).toMatchObject({
      year: 2025,
      cash: 235_374_000_000,
      intangibles: 6_842_000_000,
      longTermDebt: 40_117_000_000,
      totalAssets: 3_073_062_000_000,
      equity: 233_303_000_000,
      commonStock: 54_727_000_000,
      retainedEarnings: 178_576_000_000,
    });
  });

  it('parses cash flow and computes FCF when absent', () => {
    const res = parseStockAnalysisCashFlow(CF_HTML);
    expect(res[0]).toMatchObject({
      year: 2025,
      operatingCashFlow: 50_000_000_000,
      depreciationAmortization: 4_500_000_000,
      capex: -12_000_000_000,
      freeCashFlow: 38_000_000_000,
    });
  });

  it('parses company profile and dividends', () => {
    const comp = parseStockAnalysisCompany(COMPANY_HTML);
    expect(comp.founded).toBe(1906);
    expect(comp.employees).toBe(1076);
    expect(comp.isin).toBe('CI0000002416');
    expect(comp.executives).toHaveLength(2);

    const divs = parseStockAnalysisDividends(DIV_HTML);
    expect(divs[0]).toEqual({ exDate: '2026-08-03', payDate: '2026-08-04', amount: 768.16 });
  });
});

describe('planEnrichment guardrails', () => {
  it('fills only null fields, protects bank PNB, and flags 2022/2023 collision', () => {
    const saInc = parseStockAnalysisIncome(INCOME_HTML);
    const saBal = parseStockAnalysisBalance(BALANCE_HTML);
    const plan = planEnrichment({
      code: 'NSBC',
      famille: 'banque',
      wbIncome: [
        {
          code: 'NSBC',
          periode: '2025',
          type_periode: 'annuel',
          revenu_total: 112_928_000_000,
          resultat_exploitation: null,
          resultat_avant_impots: 43_146_000_000,
          impots: -2_434_000_000,
          resultat_net: 40_712_000_000,
          benefice_par_action: null,
          actions_en_circulation: null,
          dividende_par_action: null,
        },
        {
          code: 'NSBC',
          periode: '2023',
          type_periode: 'annuel',
          revenu_total: 91_002_000_000,
          resultat_exploitation: null,
          resultat_avant_impots: 34_540_000_000,
          impots: 2_158_000_000,
          resultat_net: 34_813_000_000,
          benefice_par_action: null,
          actions_en_circulation: null,
          dividende_par_action: null,
        },
        {
          code: 'NSBC',
          periode: '2022',
          type_periode: 'annuel',
          revenu_total: 80_105_000_000,
          resultat_exploitation: null,
          resultat_avant_impots: 34_540_000_000,
          impots: 2_158_000_000,
          resultat_net: 32_382_000_000,
          benefice_par_action: null,
          actions_en_circulation: null,
          dividende_par_action: null,
        },
      ],
      wbBalance: [
        {
          code: 'NSBC',
          periode: '2025',
          type_periode: 'annuel',
          total_actifs: 3_073_062_000_000,
          tresorerie_equivalents: null,
          investissements_court_terme: null,
          creances_clients: 1_818_671_000_000,
          stocks: null,
          immobilisations_nettes: 132_733_000_000,
          goodwill: null,
          actifs_incorporels: null,
          total_passif: 3_073_062_000_000,
          fournisseurs: null,
          dette_court_terme: 0,
          dette_long_terme: null,
          total_capitaux_propres: 233_303_000_000,
          capital_social: null,
          reserves_benefices_non_repartis: null,
        },
      ],
      wbCashFlow: [],
      wbHasDirigeants: true,
      wbLatestDividendExDate: '2026-08-03',
      wbLatestDividendGrossOrNet: 768.16,
      saIncome: saInc,
      saBalance: saBal,
      saCashFlow: [],
      saProfile: null,
      saDividends: [],
    });

    // Bank PNB (112.928B) is NOT overwritten by S&P (104.793B)
    const inc25 = plan.incomeUpserts.find((r) => r.periode === '2025');
    expect(inc25?.revenu_total).toBeUndefined();
    expect(inc25?.benefice_par_action).toBe(1645.96);

    // Balance 2025 fills null cash, intangibles, longTermDebt, capital_social, reserves
    const bal25 = plan.balanceUpserts.find((r) => r.periode === '2025');
    expect(bal25?.tresorerie_equivalents).toBe(235_374_000_000);
    expect(bal25?.dette_long_terme).toBe(40_117_000_000);
    expect(bal25?.actifs_incorporels).toBe(6_842_000_000);
    expect(bal25?.capital_social).toBe(54_727_000_000);

    // Flags 2022/2023 collision + 2025 PNB divergence
    expect(plan.discrepancies.some((d) => d.severity === 'error' && d.year === 2023)).toBe(true);
    expect(plan.discrepancies.some((d) => d.severity === 'info' && d.year === 2025)).toBe(true);
  });
});
