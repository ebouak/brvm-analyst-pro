import fs from 'node:fs';
import path from 'node:path';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import {
  parseStockAnalysisBalance,
  parseStockAnalysisCashFlow,
  parseStockAnalysisCompany,
  parseStockAnalysisDividends,
  parseStockAnalysisIncome,
} from './parse.js';
import {
  planEnrichment,
  type Discrepancy,
  type WbBalanceRow,
  type WbCashFlowRow,
  type WbIncomeRow,
} from './compare.js';

const BASE = 'https://stockanalysis.com/quote/brvm';
const UA = 'WestBourse-Verification/1.0 (+https://www.westbourse.com)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) {
        await sleep(2000 * attempt);
        continue;
      }
      if (!res.ok) return null;
      return await res.text();
    } catch {
      if (attempt === 2) return null;
      await sleep(1500);
    }
  }
  return null;
}

export interface RunStockAnalysisOptions {
  mock?: boolean;
  ecrire?: boolean;
  banques?: boolean;
  codes?: string[];
  delayMs?: number;
}

export interface RunStockAnalysisResult {
  totalStocks: number;
  enrichedStocks: number;
  totalFieldsFilled: number;
  totalDiscrepancies: number;
  echecs: number;
  reportPath: string | null;
}

export async function runStockAnalysis(opts: RunStockAnalysisOptions = {}): Promise<RunStockAnalysisResult> {
  if (opts.mock) {
    logger.info('[stockanalysis] Mode mock — aucune requête réseau ni écriture');
    return {
      totalStocks: 1,
      enrichedStocks: 0,
      totalFieldsFilled: 0,
      totalDiscrepancies: 0,
      echecs: 0,
      reportPath: null,
    };
  }

  const sb = getSupabase();
  const delayMs = opts.delayMs ?? 900;
  const ecrire = Boolean(opts.ecrire);

  let instrQuery = sb
    .from('brvm_instruments')
    .select('code, designation, famille_comptable')
    .eq('type', 'action')
    .eq('actif', true)
    .order('code', { ascending: true });

  if (opts.banques) {
    instrQuery = instrQuery.eq('famille_comptable', 'banque');
  }
  if (opts.codes && opts.codes.length > 0) {
    instrQuery = instrQuery.in('code', opts.codes.map((c) => c.toUpperCase()));
  }

  const { data: instruments, error: instrErr } = await instrQuery;
  if (instrErr || !instruments) {
    throw new Error(`Lecture brvm_instruments échouée : ${instrErr?.message ?? 'vide'}`);
  }

  const targetCodes = instruments.map((i) => i.code as string);
  logger.info(
    { count: targetCodes.length, ecrire, banques: Boolean(opts.banques) },
    '[stockanalysis] Démarrage vérification & enrichissement',
  );

  const [{ data: allInc }, { data: allBal }, { data: allCf }, { data: allProf }, { data: allDivs }] =
    await Promise.all([
      sb
        .from('income_statements')
        .select('code,periode,type_periode,revenu_total,resultat_exploitation,resultat_avant_impots,impots,resultat_net,benefice_par_action,actions_en_circulation,dividende_par_action')
        .in('code', targetCodes),
      sb
        .from('balance_sheets')
        .select('code,periode,type_periode,total_actifs,tresorerie_equivalents,investissements_court_terme,creances_clients,stocks,immobilisations_nettes,goodwill,actifs_incorporels,total_passif,fournisseurs,dette_court_terme,dette_long_terme,total_capitaux_propres,capital_social,reserves_benefices_non_repartis')
        .in('code', targetCodes),
      sb
        .from('cash_flow_statements')
        .select('code,periode,type_periode,flux_exploitation,resultat_net,depreciation_amortissement,flux_investissement,depenses_capital,flux_financement,dividendes_verses,flux_tresorerie_disponible')
        .in('code', targetCodes),
      sb.from('societes_profils').select('code,dirigeants').in('code', targetCodes),
      sb
        .from('dividends')
        .select('code,exercice,montant,montant_brut,ex_date')
        .in('code', targetCodes)
        .order('exercice', { ascending: false, nullsFirst: false }),
    ]);

  let enrichedStocks = 0;
  let totalFieldsFilled = 0;
  let echecs = 0;
  const allDiscrepancies: Discrepancy[] = [];
  const perCodeSummary: Array<{
    code: string;
    famille: string | null;
    fieldsFilled: number;
    incomePatches: number;
    balancePatches: number;
    cashFlowPatches: number;
    discrepancies: Discrepancy[];
  }> = [];

  for (const instr of instruments) {
    const code = instr.code as string;
    const famille = (instr.famille_comptable as string | null) ?? null;

    const [incHtml, balHtml, cfHtml, compHtml, divHtml] = await Promise.all([
      fetchHtml(`${BASE}/${code}/financials/income-statement/`),
      fetchHtml(`${BASE}/${code}/financials/balance-sheet/`),
      fetchHtml(`${BASE}/${code}/financials/cash-flow-statement/`),
      fetchHtml(`${BASE}/${code}/company/`),
      fetchHtml(`${BASE}/${code}/dividend/`),
    ]);

    if (!incHtml && !balHtml && !compHtml) {
      logger.warn({ code }, '[stockanalysis] Pages injoignables');
      echecs++;
      await sleep(delayMs);
      continue;
    }

    const saIncome = incHtml ? parseStockAnalysisIncome(incHtml) : [];
    const saBalance = balHtml ? parseStockAnalysisBalance(balHtml) : [];
    const saCashFlow = cfHtml ? parseStockAnalysisCashFlow(cfHtml) : [];
    const saProfile = compHtml ? parseStockAnalysisCompany(compHtml) : null;
    const saDividends = divHtml ? parseStockAnalysisDividends(divHtml) : [];

    const wbIncome = ((allInc ?? []) as WbIncomeRow[]).filter((r) => r.code === code);
    const wbBalance = ((allBal ?? []) as WbBalanceRow[]).filter((r) => r.code === code);
    const wbCashFlow = ((allCf ?? []) as WbCashFlowRow[]).filter((r) => r.code === code);
    const prof = (allProf ?? []).find((p) => p.code === code) as { dirigeants?: unknown[] } | undefined;
    const wbHasDirigeants = Array.isArray(prof?.dirigeants) && prof.dirigeants.length > 0;
    const divRows = (allDivs ?? []).filter((d) => d.code === code) as Array<{
      ex_date: string | null;
      montant: number;
      montant_brut: number | null;
    }>;
    const latestDiv = divRows.find((d) => d.ex_date != null) ?? null;

    const plan = planEnrichment({
      code,
      famille,
      wbIncome,
      wbBalance,
      wbCashFlow,
      wbHasDirigeants,
      wbLatestDividendExDate: latestDiv?.ex_date ?? null,
      wbLatestDividendGrossOrNet: latestDiv ? latestDiv.montant_brut ?? latestDiv.montant : null,
      saIncome,
      saBalance,
      saCashFlow,
      saProfile,
      saDividends,
    });

    if (ecrire && plan.fieldsFilled > 0) {
      const existingInc = new Set(wbIncome.filter((r) => r.type_periode === 'annuel').map((r) => r.periode));
      for (const patch of plan.incomeUpserts) {
        if (existingInc.has(patch.periode)) {
          const { code: c, periode, type_periode, ...fields } = patch;
          const { error } = await sb
            .from('income_statements')
            .update(fields)
            .eq('code', c)
            .eq('periode', periode)
            .eq('type_periode', type_periode);
          if (error) {
            logger.error({ code, periode, err: error.message }, '[stockanalysis] Erreur update income_statements');
            echecs++;
          }
        } else {
          const { error } = await sb.from('income_statements').insert(patch);
          if (error) {
            logger.error({ code, periode: patch.periode, err: error.message }, '[stockanalysis] Erreur insert income_statements');
            echecs++;
          }
        }
      }

      const existingBal = new Set(wbBalance.filter((r) => r.type_periode === 'annuel').map((r) => r.periode));
      for (const patch of plan.balanceUpserts) {
        if (existingBal.has(patch.periode)) {
          const { code: c, periode, type_periode, ...fields } = patch;
          const { error } = await sb
            .from('balance_sheets')
            .update(fields)
            .eq('code', c)
            .eq('periode', periode)
            .eq('type_periode', type_periode);
          if (error) {
            logger.error({ code, periode, err: error.message }, '[stockanalysis] Erreur update balance_sheets');
            echecs++;
          }
        } else {
          const { error } = await sb.from('balance_sheets').insert(patch);
          if (error) {
            logger.error({ code, periode: patch.periode, err: error.message }, '[stockanalysis] Erreur insert balance_sheets');
            echecs++;
          }
        }
      }

      const existingCf = new Set(wbCashFlow.filter((r) => r.type_periode === 'annuel').map((r) => r.periode));
      for (const patch of plan.cashFlowUpserts) {
        if (existingCf.has(patch.periode)) {
          const { code: c, periode, type_periode, ...fields } = patch;
          const { error } = await sb
            .from('cash_flow_statements')
            .update(fields)
            .eq('code', c)
            .eq('periode', periode)
            .eq('type_periode', type_periode);
          if (error) {
            logger.error({ code, periode, err: error.message }, '[stockanalysis] Erreur update cash_flow_statements');
            echecs++;
          }
        } else {
          const { error } = await sb.from('cash_flow_statements').insert(patch);
          if (error) {
            logger.error({ code, periode: patch.periode, err: error.message }, '[stockanalysis] Erreur insert cash_flow_statements');
            echecs++;
          }
        }
      }
    }

    if (plan.fieldsFilled > 0) {
      enrichedStocks++;
      totalFieldsFilled += plan.fieldsFilled;
    }
    allDiscrepancies.push(...plan.discrepancies);
    perCodeSummary.push({
      code,
      famille,
      fieldsFilled: plan.fieldsFilled,
      incomePatches: plan.incomeUpserts.length,
      balancePatches: plan.balanceUpserts.length,
      cashFlowPatches: plan.cashFlowUpserts.length,
      discrepancies: plan.discrepancies,
    });

    logger.info(
      {
        code,
        fieldsFilled: plan.fieldsFilled,
        discrepancies: plan.discrepancies.length,
        mode: ecrire ? 'ecrit' : 'a-blanc',
      },
      '[stockanalysis] Traité',
    );
    await sleep(delayMs);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(process.cwd(), 'output', 'stockanalysis');
  fs.mkdirSync(outDir, { recursive: true });
  const mdPath = path.join(outDir, `verification-${today}.md`);
  const jsonPath = path.join(outDir, `verification-${today}.json`);

  const lines: string[] = [
    `# Vérification & Enrichissement StockAnalysis (${today})`,
    '',
    `- Mode : **${ecrire ? 'ÉCRITURE EN BASE' : 'À BLANC (dry-run)'}**`,
    `- Valeurs analysées : **${instruments.length}**`,
    `- Valeurs enrichies (ou enrichissables) : **${enrichedStocks}**`,
    `- Champs complétés : **${totalFieldsFilled}**`,
    `- Incohérences / écarts détectés : **${allDiscrepancies.length}**`,
    `- Échecs réseau/base : **${echecs}**`,
    '',
    '## Résumé par valeur',
    '',
    '| Code | Famille | Champs complétés | CR | Bilan | Flux | Écarts |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...perCodeSummary.map(
      (s) =>
        `| ${s.code} | ${s.famille ?? '—'} | ${s.fieldsFilled} | ${s.incomePatches} | ${s.balancePatches} | ${s.cashFlowPatches} | ${s.discrepancies.length} |`,
    ),
    '',
    '## Incohérences & alertes',
    '',
    ...allDiscrepancies.map((d) => `- **[${d.severity.toUpperCase()}] ${d.code}** (${d.category}${d.year ? ` ${d.year}` : ''}) : ${d.message}`),
  ];

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ date: today, ecrire, perCodeSummary, allDiscrepancies }, null, 2),
    'utf8',
  );

  return {
    totalStocks: instruments.length,
    enrichedStocks,
    totalFieldsFilled,
    totalDiscrepancies: allDiscrepancies.length,
    echecs,
    reportPath: mdPath,
  };
}
