// frontend/lib/export/xlsx.ts
import ExcelJS from 'exceljs';
import type { IncomeStatement, BalanceSheet, CashFlowStatement, FundamentalRatios } from '@/lib/financials/types';

const HDR = 'FF0F1117';
const TXT = 'FFE6E9F0';
const MUT = 'FF8B93A7';

function head(ws: ExcelJS.Worksheet, cols: string[], rowNum: number) {
  const row = ws.getRow(rowNum);
  cols.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, color: { argb: TXT }, name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR } };
    cell.alignment = { horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: '30363D' } } };
  });
}

function dataRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], rowNum: number, isEven: boolean) {
  const row = ws.getRow(rowNum);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v ?? '';
    cell.font = { color: { argb: typeof v === 'number' ? TXT : MUT }, name: 'Calibri', size: 9 };
    if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2030' } };
  });
}

function fcfa(n: number | null) { return n != null ? Math.round(n) : null; }
function pct(n: number | null)  { return n != null ? `${n.toFixed(1)}%` : '—'; }
function ratio(n: number | null){ return n != null ? `${n.toFixed(2)}x` : '—'; }

export async function generateXlsxBlob(params: {
  code: string;
  designation: string | null;
  secteur: string | null;
  ratios: FundamentalRatios;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
}): Promise<Blob> {
  const { code, designation, secteur, ratios, incomeStatements, balanceSheets, cashFlowStatements } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BRVM Analyst Pro';
  wb.created = new Date();

  // Feuille 1 : Résumé
  const ws1 = wb.addWorksheet('Résumé');
  ws1.getColumn(1).width = 32;
  ws1.getColumn(2).width = 20;

  ws1.getCell('A1').value = `${code} — ${designation ?? code}`;
  ws1.getCell('A1').font = { bold: true, size: 14, name: 'Calibri' };
  ws1.getCell('A2').value = secteur ?? '';
  ws1.getCell('A2').font = { color: { argb: MUT }, size: 10, name: 'Calibri' };
  ws1.getCell('A3').value = `Généré le ${new Date().toLocaleDateString('fr-FR')} — BRVM Analyst Pro`;
  ws1.getCell('A3').font = { color: { argb: MUT }, size: 9, italic: true, name: 'Calibri' };

  const ratioRows: [string, string][] = [
    ['Cours actuel (FCFA)', ratios.cours_actuel != null ? `${ratios.cours_actuel.toLocaleString('fr-FR')}` : '—'],
    ['52s bas / haut', `${ratios.cours_bas_52s ?? '—'} / ${ratios.cours_haut_52s ?? '—'}`],
    ['Capitalisation (FCFA)', ratios.capitalisation != null ? ratios.capitalisation.toLocaleString('fr-FR') : '—'],
    ['PER', ratio(ratios.per)],
    ['P/Book', ratio(ratios.pb)],
    ['P/CA', ratio(ratios.ps)],
    ['BPA (FCFA/action)', ratios.bpa != null ? ratios.bpa.toFixed(2) : '—'],
    ['Rendement dividende', pct(ratios.rendement_dividende)],
    ['Payout ratio', pct(ratios.payout)],
    ['ROE', pct(ratios.roe)],
    ['Marge nette', pct(ratios.marge_nette)],
    ['Dette / Capitaux propres', ratio(ratios.dette_sur_capitaux_propres)],
    ['Croissance CA (YoY)', pct(ratios.croissance_ca)],
    ['Croissance RN (YoY)', pct(ratios.croissance_rn)],
  ];

  head(ws1, ['Indicateur', 'Valeur'], 5);
  ratioRows.forEach(([label, val], i) => {
    dataRow(ws1, [label, val], 6 + i, i % 2 === 0);
  });

  // Feuille 2 : Compte de résultat
  const ws2 = wb.addWorksheet('Compte de résultat');
  ws2.getColumn(1).width = 32;
  incomeStatements.forEach((_, i) => { ws2.getColumn(i + 2).width = 18; });

  const incomeCols = ['Indicateur', ...incomeStatements.map((s) => s.periode)];
  head(ws2, incomeCols, 1);

  const incomeFields: Array<[string, keyof IncomeStatement]> = [
    ['Revenus totaux', 'revenu_total'],
    ['Coût des ventes', 'cout_ventes'],
    ['Marge brute', 'marge_brute'],
    ['Frais généraux', 'frais_generaux_admin'],
    ['Résultat exploitation (EBIT)', 'resultat_exploitation'],
    ['Charges financières nettes', 'charges_financieres_nettes'],
    ['Résultat avant impôts', 'resultat_avant_impots'],
    ['Impôts', 'impots'],
    ['Résultat net', 'resultat_net'],
    ['BPA (FCFA)', 'benefice_par_action'],
    ['Dividende / action (FCFA)', 'dividende_par_action'],
    ['Actions en circulation', 'actions_en_circulation'],
  ];

  incomeFields.forEach(([label, key], ri) => {
    const vals = incomeStatements.map((s) => {
      const v = s[key] as number | null;
      return key === 'benefice_par_action' || key === 'dividende_par_action' ? v : fcfa(v);
    });
    dataRow(ws2, [label, ...vals], 2 + ri, ri % 2 === 0);
  });

  // Feuille 3 : Bilan & Flux
  const ws3 = wb.addWorksheet('Bilan & Flux');
  ws3.getColumn(1).width = 36;
  balanceSheets.forEach((_, i) => { ws3.getColumn(i + 2).width = 18; });

  const balCols = ['Bilan', ...balanceSheets.map((s) => s.periode)];
  head(ws3, balCols, 1);

  const balFields: Array<[string, keyof BalanceSheet]> = [
    ['Total actifs', 'total_actifs'],
    ['Actif circulant', 'total_actif_circulant'],
    ['  Trésorerie', 'tresorerie_equivalents'],
    ['  Créances clients', 'creances_clients'],
    ['  Stocks', 'stocks'],
    ['Actif non courant', 'total_actif_non_courant'],
    ['  Immobilisations nettes', 'immobilisations_nettes'],
    ['Total capitaux propres', 'total_capitaux_propres'],
    ['  Capital social', 'capital_social'],
    ['  Réserves', 'reserves_benefices_non_repartis'],
    ['Passif courant', 'passif_courant'],
    ['  Dette court terme', 'dette_court_terme'],
    ['Passif non courant', 'passif_non_courant'],
    ['  Dette long terme', 'dette_long_terme'],
  ];

  balFields.forEach(([label, key], ri) => {
    const vals = balanceSheets.map((s) => fcfa(s[key] as number | null));
    dataRow(ws3, [label, ...vals], 2 + ri, ri % 2 === 0);
  });

  const cfRow = balFields.length + 3;
  head(ws3, ['Flux de trésorerie', ...cashFlowStatements.map((s) => s.periode)], cfRow);

  const cfFields: Array<[string, keyof CashFlowStatement]> = [
    ['Flux exploitation (CFO)', 'flux_exploitation'],
    ['  Résultat net', 'resultat_net'],
    ['  Amortissements', 'depreciation_amortissement'],
    ['Flux investissement', 'flux_investissement'],
    ['  Capex (investissements)', 'investissements_ppe'],
    ['Flux financement', 'flux_financement'],
    ['  Dividendes versés', 'dividendes_verses'],
    ['Variation trésorerie', 'variation_tresorerie'],
    ['Free Cash-Flow', 'flux_tresorerie_disponible'],
  ];

  cfFields.forEach(([label, key], ri) => {
    const vals = cashFlowStatements.map((s) => fcfa(s[key] as number | null));
    dataRow(ws3, [label, ...vals], cfRow + 1 + ri, ri % 2 === 0);
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
