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

/** Candidats de sélecteur pour le GridView des actions — calibré sur bfin.brvm.org 2026-05. */
export const ACTIONS_TABLE_SELECTORS = [
  '#ctl00_Main_GridView1',
  '#ContentPlaceHolder1_GridViewActions',
  '#ContentPlaceHolder1_gvActions',
  '#ContentPlaceHolder1_GridView1',
  'table[id*="GridView1"]',
  'table[id*="Actions"]',
  'table.gridcontent',
];

/** Alias d'en-tête -> champ logique (synchronisé avec selectors.ts ACTIONS_COLUMNS). */
const COLUMN_SPEC: Record<string, string[]> = {
  code:            ['code', 'symbole', 'ticker'],
  designation:     ['designation', 'libelle', 'titre', 'societe', 'valeur'],
  pays:            ['pays'],
  secteur:         ['secteur', 'activite'],
  cours_precedent: ['cours precedent', 'cours veille', 'precedent', 'cloture veille', 'cloture precedente'],
  cours_jour:      ['cours jour', 'cours du jour', 'cloture', 'dernier cours', 'cours'],
  // Colonne absente sur BDFIN — variation calculée post-parse.
  variation_pct:   ['variation %', 'var %', 'var. %', 'variation pct'],
  volume:          ['volume', 'volume echange', 'titres echanges', 'quantite echangee', 'quantite'],
  nb_transactions: ['nombre transactions', 'nb transactions', 'transactions', 'nombre de transactions'],
  valeur_echangee: ['valeur echangee', 'valeur echange', 'montant', 'capitaux'],
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

    const cours_precedent = parseFrNumber(cell(row, idx, 'cours_precedent'));
    const cours_jour = parseFrNumber(cell(row, idx, 'cours_jour'));

    // BDFIN n'affiche pas de colonne variation% — on la calcule depuis les cours.
    let variation_pct = parseFrNumber(cell(row, idx, 'variation_pct'));
    if (variation_pct == null && cours_precedent != null && cours_jour != null && cours_precedent > 0) {
      variation_pct = Math.round(((cours_jour - cours_precedent) / cours_precedent) * 10000) / 100;
    }

    out.push({
      code: code || designation.slice(0, 12).toUpperCase(),
      designation: designation || code,
      pays: cleanText(cell(row, idx, 'pays')) || null,
      secteur: cleanText(cell(row, idx, 'secteur')) || null,
      cours_precedent,
      cours_jour,
      variation_pct,
      volume: parseFrInt(cell(row, idx, 'volume')),
      nb_transactions: parseFrInt(cell(row, idx, 'nb_transactions')),
      valeur_echangee: parseFrNumber(cell(row, idx, 'valeur_echangee')),
    });
  }

  logger.info({ count: out.length }, 'Actions parsées');
  return out;
}
