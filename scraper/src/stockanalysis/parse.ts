import * as cheerio from 'cheerio';

export interface SaIncomeYear {
  year: number;
  revenue: number | null;
  operatingIncome: number | null;
  pretaxIncome: number | null;
  incomeTax: number | null;
  netIncome: number | null;
  eps: number | null;
  shares: number | null;
  dividendPerShare: number | null;
}

export interface SaBalanceYear {
  year: number;
  cash: number | null;
  shortTermInvestments: number | null;
  receivables: number | null;
  inventory: number | null;
  ppe: number | null;
  goodwill: number | null;
  intangibles: number | null;
  totalAssets: number | null;
  accountsPayable: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  totalLiabilities: number | null;
  commonStock: number | null;
  retainedEarnings: number | null;
  equity: number | null;
  shares: number | null;
}

export interface SaCashFlowYear {
  year: number;
  operatingCashFlow: number | null;
  depreciationAmortization: number | null;
  capex: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  dividendsPaid: number | null;
  freeCashFlow: number | null;
}

export interface SaExecutive {
  name: string;
  position: string;
}

export interface SaCompanyProfile {
  founded: number | null;
  employees: number | null;
  isin: string | null;
  website: string | null;
  executives: SaExecutive[];
}

export interface SaDividendRow {
  exDate: string | null;
  payDate: string | null;
  amount: number | null;
}

function parseRawNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '').replace(/\u00a0/g, '').replace(/\s+/g, '');
  if (!cleaned || cleaned === '-' || cleaned === 'n/a' || cleaned === 'N/A' || cleaned === '—') {
    return null;
  }
  const pct = cleaned.endsWith('%');
  const numStr = pct ? cleaned.slice(0, -1) : cleaned;
  const val = Number(numStr);
  return Number.isFinite(val) ? val : null;
}

function detectMultiplier(html: string): number {
  const lower = html.toLowerCase();
  if (lower.includes('in millions xof') || lower.includes('millions xof.')) return 1_000_000;
  if (lower.includes('in billions xof') || lower.includes('billions xof.')) return 1_000_000_000;
  if (lower.includes('in thousands xof') || lower.includes('thousands xof.')) return 1_000;
  return 1_000_000;
}

interface ParsedTable {
  years: Array<{ colIdx: number; year: number }>;
  rows: Map<string, Map<number, number | null>>;
  multiplier: number;
}

function parseFinancialTables(html: string): ParsedTable {
  const $ = cheerio.load(html);
  const multiplier = detectMultiplier(html);
  const yearsMap = new Map<number, number>();
  const rows = new Map<string, Map<number, number | null>>();

  $('table').each((_, table) => {
    const headerCells = $(table).find('thead tr').first().find('th, td');
    const colToYear = new Map<number, number>();
    headerCells.each((idx, th) => {
      const txt = $(th).text().trim();
      const m = /^FY\s+(\d{4})$/i.exec(txt) || /^(\d{4})$/.exec(txt);
      if (m) {
        const y = Number(m[1]);
        if (y >= 2000 && y <= 2035) {
          colToYear.set(idx, y);
          yearsMap.set(y, y);
        }
      }
    });
    if (colToYear.size === 0) return;

    $(table)
      .find('tbody tr')
      .each((__, tr) => {
        const cells = $(tr).find('td, th');
        if (cells.length < 2) return;
        const label = $(cells[0]).text().trim().toLowerCase().replace(/\s+/g, ' ');
        if (!label) return;
        const yearVals = rows.get(label) ?? new Map<number, number | null>();
        for (const [colIdx, year] of colToYear.entries()) {
          if (colIdx < cells.length) {
            const val = parseRawNumber($(cells[colIdx]).text());
            if (!yearVals.has(year) || val !== null) {
              yearVals.set(year, val);
            }
          }
        }
        rows.set(label, yearVals);
      });
  });

  const years = [...yearsMap.keys()]
    .sort((a, b) => b - a)
    .map((year, colIdx) => ({ colIdx, year }));

  return { years, rows, multiplier };
}

function pick(
  rows: Map<string, Map<number, number | null>>,
  labels: string[],
  year: number,
  scale: number,
): number | null {
  for (const label of labels) {
    const m = rows.get(label.toLowerCase());
    if (m && m.has(year)) {
      const v = m.get(year) ?? null;
      return v === null ? null : Math.round(v * scale);
    }
  }
  return null;
}

function pickExact(
  rows: Map<string, Map<number, number | null>>,
  labels: string[],
  year: number,
): number | null {
  for (const label of labels) {
    const m = rows.get(label.toLowerCase());
    if (m && m.has(year)) {
      const v = m.get(year) ?? null;
      return v === null ? null : v;
    }
  }
  return null;
}

export function parseStockAnalysisIncome(html: string): SaIncomeYear[] {
  const { years, rows, multiplier } = parseFinancialTables(html);
  return years.map(({ year }) => ({
    year,
    revenue: pick(rows, ['revenue', 'total revenue'], year, multiplier),
    operatingIncome: pick(rows, ['operating income'], year, multiplier),
    pretaxIncome: pick(rows, ['pretax income', 'ebt excluding unusual items'], year, multiplier),
    incomeTax: pick(rows, ['income tax expense'], year, multiplier),
    netIncome: pick(rows, ['net income', 'net income to common'], year, multiplier),
    eps: pickExact(rows, ['eps (basic)', 'eps (diluted)', 'earnings per share'], year),
    shares: pick(rows, ['basic shares outstanding', 'diluted shares outstanding'], year, multiplier),
    dividendPerShare: pickExact(rows, ['dividend per share'], year),
  }));
}

export function parseStockAnalysisBalance(html: string): SaBalanceYear[] {
  const { years, rows, multiplier } = parseFinancialTables(html);
  return years.map(({ year }) => {
    const commonStock = pick(rows, ['common stock'], year, multiplier);
    const apic = pick(rows, ['additional paid-in capital'], year, multiplier);
    const retained = pick(rows, ['retained earnings'], year, multiplier);
    return {
      year,
      cash: pick(rows, ['cash & equivalents', 'cash & short-term investments'], year, multiplier),
      shortTermInvestments: pick(rows, ['short-term investments', 'investment securities'], year, multiplier),
      receivables: pick(rows, ['accounts receivable', 'receivables', 'gross loans', 'net loans'], year, multiplier),
      inventory: pick(rows, ['inventory'], year, multiplier),
      ppe: pick(rows, ['property, plant & equipment'], year, multiplier),
      goodwill: pick(rows, ['goodwill'], year, multiplier),
      intangibles: pick(rows, ['other intangible assets', 'intangible assets'], year, multiplier),
      totalAssets: pick(rows, ['total assets'], year, multiplier),
      accountsPayable: pick(rows, ['accounts payable'], year, multiplier),
      shortTermDebt: pick(rows, ['short-term debt', 'current portion of long-term debt'], year, multiplier),
      longTermDebt: pick(rows, ['long-term debt', 'total debt'], year, multiplier),
      totalLiabilities: pick(rows, ['total liabilities'], year, multiplier),
      commonStock: commonStock !== null && apic !== null ? commonStock + apic : commonStock,
      retainedEarnings: retained,
      equity: pick(rows, ["shareholders' equity", 'total equity'], year, multiplier),
      shares: pick(rows, ['total common shares outstanding', 'filing date shares outstanding'], year, multiplier),
    };
  });
}

export function parseStockAnalysisCashFlow(html: string): SaCashFlowYear[] {
  const { years, rows, multiplier } = parseFinancialTables(html);
  return years.map(({ year }) => {
    const cfo = pick(rows, ['operating cash flow'], year, multiplier);
    const capex = pick(rows, ['capital expenditures'], year, multiplier);
    const fcfRaw = pick(rows, ['free cash flow'], year, multiplier);
    const fcf = fcfRaw !== null ? fcfRaw : cfo !== null && capex !== null ? cfo - Math.abs(capex) : null;
    return {
      year,
      operatingCashFlow: cfo,
      depreciationAmortization: pick(rows, ['depreciation & amortization'], year, multiplier),
      capex,
      investingCashFlow: pick(rows, ['investing cash flow'], year, multiplier),
      financingCashFlow: pick(rows, ['financing cash flow'], year, multiplier),
      dividendsPaid: pick(rows, ['dividends paid'], year, multiplier),
      freeCashFlow: fcf,
    };
  });
}

export function parseStockAnalysisCompany(html: string): SaCompanyProfile {
  const $ = cheerio.load(html);
  let founded: number | null = null;
  let employees: number | null = null;
  let isin: string | null = null;
  let website: string | null = null;
  const executives: SaExecutive[] = [];

  $('tr').each((_, tr) => {
    const cells = $(tr).find('td, th');
    if (cells.length === 2) {
      const k = $(cells[0]).text().trim().toLowerCase();
      const v = $(cells[1]).text().trim();
      if (k === 'founded' && /^\d{4}$/.test(v)) founded = Number(v);
      else if (k === 'employees') {
        const n = parseRawNumber(v);
        if (n !== null && n > 0) employees = Math.round(n);
      } else if (k === 'isin number' || k === 'isin') {
        if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(v)) isin = v;
      } else if (k === 'website') {
        const href = $(cells[1]).find('a').attr('href');
        if (href && /^https?:\/\//.test(href)) website = href;
      } else if (
        v &&
        !k.includes('name') &&
        !k.includes('symbol') &&
        !k.includes('currency') &&
        !k.includes('exchange') &&
        !k.includes('fiscal') &&
        !k.includes('country') &&
        !k.includes('industry') &&
        !k.includes('sic') &&
        !k.includes('phone') &&
        !k.includes('address') &&
        !k.includes('ceo') &&
        $(tr).closest('table').find('th').first().text().trim().toLowerCase() === 'name'
      ) {
        executives.push({ name: $(cells[0]).text().trim(), position: v });
      }
    }
  });

  const text = $('body').text().replace(/\s+/g, ' ');
  if (founded === null) {
    const m = /\bFounded\s+(\d{4})\b/i.exec(text);
    if (m) founded = Number(m[1]);
  }
  if (employees === null) {
    const m = /\bEmployees\s+([\d,]+)\b/i.exec(text);
    if (m?.[1]) {
      const n = parseRawNumber(m[1]);
      if (n !== null && n > 0) employees = Math.round(n);
    }
  }
  if (isin === null) {
    const m = /\bISIN Number\s+([A-Z]{2}[A-Z0-9]{10})\b/.exec(text);
    if (m?.[1]) isin = m[1];
  }

  return { founded, employees, isin, website, executives };
}

const US_MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseUsDateToIso(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === '-' || t.toLowerCase() === 'n/a') return null;
  const m = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
  if (m && m[1] && m[2] && m[3]) {
    const mm = US_MONTHS[m[1].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[2].padStart(2, '0')}`;
  }
  const d = new Date(`${t} UTC`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseStockAnalysisDividends(html: string): SaDividendRow[] {
  const $ = cheerio.load(html);
  const out: SaDividendRow[] = [];
  $('table').each((_, table) => {
    const headers = $(table)
      .find('thead th')
      .map((__, th) => $(th).text().trim().toLowerCase())
      .get();
    const exIdx = headers.findIndex((h) => h.includes('ex-dividend'));
    const amtIdx = headers.findIndex((h) => h.includes('cash amount'));
    const payIdx = headers.findIndex((h) => h.includes('pay date'));
    if (exIdx === -1 || amtIdx === -1) return;

    $(table)
      .find('tbody tr')
      .each((__, tr) => {
        const tds = $(tr).find('td');
        if (tds.length <= Math.max(exIdx, amtIdx)) return;
        const exDate = parseUsDateToIso($(tds[exIdx]).text());
        const payDate = payIdx >= 0 && payIdx < tds.length ? parseUsDateToIso($(tds[payIdx]).text()) : null;
        const amtText = $(tds[amtIdx]).text().replace(/XOF/gi, '').trim();
        const amount = parseRawNumber(amtText);
        if (exDate || amount !== null) {
          out.push({ exDate, payDate, amount });
        }
      });
  });
  return out;
}
