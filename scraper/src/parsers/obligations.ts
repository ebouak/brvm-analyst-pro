/**
 * Parser du tableau des OBLIGATIONS de la page Activites_marche.aspx.
 */
import * as cheerio from 'cheerio';
import type { ObligationRow } from '../types.js';
import { parseFrNumber, parseFrInt, cleanText } from '../utils/parseNumber.js';
import {
  parseTable,
  buildColumnIndex,
  cell,
  isDataRow,
  type ParsedTable,
} from './table.js';
import { parseFrDate } from '../utils/dates.js';
import { logger } from '../logger.js';

/** Calibré sur bfin.brvm.org 2026-05. */
export const OBLIGATIONS_TABLE_SELECTORS = [
  '#ctl00_Main_GridView2',
  '#ContentPlaceHolder1_GridViewObligations',
  '#ContentPlaceHolder1_gvObligations',
  '#ContentPlaceHolder1_GridView2',
  'table[id*="GridView2"]',
  'table[id*="Obligation"]',
];

const COLUMN_SPEC: Record<string, string[]> = {
  code: ['isin', 'code isin', 'code'],
  designation: ['designation', 'libelle', 'titre', 'obligation'],
  emetteur: ['emetteur', 'emmetteur', 'issuer'],
  taux_pct: ['taux', 'coupon', 'taux nominal'],
  maturite: ['maturite', 'echeance', 'date echeance'],
  cours_precedent: ['cours precedent', 'precedent', 'prix precedent'],
  cours_jour: ['cours jour', 'cours', 'prix', 'dernier cours'],
  volume: ['volume', 'quantite', 'titres echanges'],
  valeur_echangee: ['valeur echangee', 'valeur', 'montant', 'capitaux'],
};

export function parseObligations(html: string): ObligationRow[] {
  const $ = cheerio.load(html);

  let table: ParsedTable | null = null;
  for (const sel of OBLIGATIONS_TABLE_SELECTORS) {
    table = parseTable($, sel);
    if (table && table.rows.length > 0) {
      logger.debug(
        { selector: sel, rows: table.rows.length },
        'Table obligations trouvée',
      );
      break;
    }
  }
  if (!table || table.rows.length === 0) {
    logger.warn('Aucun tableau obligations exploitable trouvé');
    return [];
  }

  const idx = buildColumnIndex(table.headers, COLUMN_SPEC);

  const out: ObligationRow[] = [];
  for (const row of table.rows) {
    if (!isDataRow(row)) continue;
    const code = cleanText(cell(row, idx, 'code'));
    const designation = cleanText(cell(row, idx, 'designation'));
    if (!code && !designation) continue;

    out.push({
      code: code || designation.slice(0, 16).toUpperCase(),
      designation: designation || code,
      emetteur: cleanText(cell(row, idx, 'emetteur')) || null,
      taux_pct: parseFrNumber(cell(row, idx, 'taux_pct')),
      maturite: parseFrDate(cell(row, idx, 'maturite')),
      cours_precedent: parseFrNumber(cell(row, idx, 'cours_precedent')),
      cours_jour: parseFrNumber(cell(row, idx, 'cours_jour')),
      volume: parseFrInt(cell(row, idx, 'volume')),
      valeur_echangee: parseFrNumber(cell(row, idx, 'valeur_echangee')),
    });
  }

  logger.info({ count: out.length }, 'Obligations parsées');
  return out;
}
