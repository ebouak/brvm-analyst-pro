/**
 * Parser du tableau des ACTIONS de la page Activites_marche.aspx.
 *
 * Le sélecteur du tableau (ACTIONS_TABLE_SELECTOR) doit être calibré sur le
 * markup réel BDFIN (id du GridView). Plusieurs candidats sont essayés.
 */
import * as cheerio from 'cheerio';
import type { ActionRow } from '../types.js';
import { parseFrNumber, parseFrInt, cleanText } from '../utils/parseNumber.js';
import {
  parseTable,
  buildColumnIndex,
  cell,
  isDataRow,
  type ParsedTable,
} from './table.js';
import { logger } from '../logger.js';

/** Candidats de sélecteur pour le GridView des actions (calibrer si besoin). */
export const ACTIONS_TABLE_SELECTORS = [
  '#ContentPlaceHolder1_GridViewActions',
  '#ContentPlaceHolder1_gvActions',
  'table[id*="Actions"]',
  'table.gridActions',
];

/** Alias d'en-tête -> champ logique. Étendre selon les libellés réels. */
const COLUMN_SPEC: Record<string, string[]> = {
  code: ['code', 'symbole', 'ticker'],
  designation: ['designation', 'libelle', 'titre', 'valeur', 'societe'],
  pays: ['pays'],
  secteur: ['secteur', 'activite'],
  cours_precedent: ['cours precedent', 'cours veille', 'precedent', 'cloture veille'],
  cours_jour: ['cours jour', 'cours du jour', 'cours', 'dernier cours', 'cloture'],
  variation_pct: ['variation', 'var', 'variation pct', 'var %'],
  volume: ['volume', 'titres echanges', 'quantite'],
  nb_transactions: ['transactions', 'nb transactions', 'nombre de transactions'],
  valeur_echangee: ['valeur echangee', 'valeur', 'montant', 'capitaux'],
};

export function parseActions(html: string): ActionRow[] {
  const $ = cheerio.load(html);

  let table: ParsedTable | null = null;
  for (const sel of ACTIONS_TABLE_SELECTORS) {
    table = parseTable($, sel);
    if (table && table.rows.length > 0) {
      logger.debug({ selector: sel, rows: table.rows.length }, 'Table actions trouvée');
      break;
    }
  }
  if (!table || table.rows.length === 0) {
    logger.warn('Aucun tableau actions exploitable trouvé');
    return [];
  }

  const idx = buildColumnIndex(table.headers, COLUMN_SPEC);
  if (idx.code == null && idx.designation == null) {
    logger.warn(
      { headers: table.headers },
      'Colonnes code/designation introuvables — calibrage COLUMN_SPEC requis',
    );
  }

  const out: ActionRow[] = [];
  for (const row of table.rows) {
    if (!isDataRow(row)) continue;
    const code = cleanText(cell(row, idx, 'code'));
    const designation = cleanText(cell(row, idx, 'designation'));
    // Une ligne sans code ni désignation n'est pas exploitable.
    if (!code && !designation) continue;

    out.push({
      code: code || designation.slice(0, 12).toUpperCase(),
      designation: designation || code,
      pays: cleanText(cell(row, idx, 'pays')) || null,
      secteur: cleanText(cell(row, idx, 'secteur')) || null,
      cours_precedent: parseFrNumber(cell(row, idx, 'cours_precedent')),
      cours_jour: parseFrNumber(cell(row, idx, 'cours_jour')),
      variation_pct: parseFrNumber(cell(row, idx, 'variation_pct')),
      volume: parseFrInt(cell(row, idx, 'volume')),
      nb_transactions: parseFrInt(cell(row, idx, 'nb_transactions')),
      valeur_echangee: parseFrNumber(cell(row, idx, 'valeur_echangee')),
    });
  }

  logger.info({ count: out.length }, 'Actions parsées');
  return out;
}
