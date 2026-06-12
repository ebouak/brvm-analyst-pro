/**
 * Parsers pour l'intégration BDFIN (Obscura).
 * Extraction d'instruments et d'activités de marché depuis HTML BDFIN.
 */
import * as cheerio from 'cheerio';
import { parseFrNumber, parseFrInt, cleanText } from '../../utils/parseNumber.js';
import { buildColumnIndex, normalizeHeader } from '../../parsers/table.js';
import type { BdfinInstrument, BdfinMarketDataRow, BdfinMarketData } from './types.js';

const INSTRUMENTS_TABLE_SELECTORS = {
  table: 'table[id*="Instruments"], table.instruments-grid',
  rows: 'tr',
  header: 'thead tr',
};

const INSTRUMENTS_COLUMN_SPEC: Record<string, string[]> = {
  code: ['code', 'symbole', 'ticker'],
  designation: ['designation', 'libelle', 'titre', 'societe', 'valeur'],
  pays: ['pays', 'country'],
  secteur: ['secteur', 'activite', 'sector'],
  type: ['type', 'categorie'],
  statut: ['statut', 'status', 'etat'],
  isin: ['isin', 'code isin'],
};

const MARKET_TABLE_SELECTORS = {
  actionsTable: 'table[id*="Actions"], table.actions-grid',
  obligationsTable: 'table[id*="Obligations"], table.obligations-grid',
  rows: 'tr',
  header: 'thead tr',
};

const MARKET_COLUMN_SPEC: Record<string, string[]> = {
  code: ['code', 'symbole', 'ticker'],
  designation: ['designation', 'libelle', 'titre', 'societe', 'valeur'],
  cours_jour: ['cours jour', 'cours du jour', 'cloture', 'dernier cours', 'cours'],
  cours_precedent: ['cours precedent', 'cours veille', 'precedent', 'cloture veille', 'cloture precedente'],
  variation_pct: ['variation', 'var', '%var'],
  volume: ['volume', 'volume echange', 'titres echanges', 'quantite echangee', 'quantite'],
  nb_transactions: ['nombre transactions', 'nb transactions', 'transactions', 'nombre de transactions'],
  valeur_echangee: ['valeur echangee', 'valeur echange', 'montant', 'capitaux'],
};

/**
 * Parse un tableau d'instruments BDFIN.
 * Retourne la liste des instruments trouvés.
 */
export function parseBdfinInstruments(html: string): BdfinInstrument[] {
  const $ = cheerio.load(html);
  const instruments: BdfinInstrument[] = [];

  const table = $(INSTRUMENTS_TABLE_SELECTORS.table).first();
  if (!table.length) return instruments;

  // Extraire les en-têtes
  const headerRow = table.find(INSTRUMENTS_TABLE_SELECTORS.header).first();
  if (!headerRow.length) return instruments;

  const headers = headerRow
    .find('th')
    .toArray()
    .map((el) => normalizeHeader($(el).text()));

  const columnIndex = buildColumnIndex(headers, INSTRUMENTS_COLUMN_SPEC);
  if (Object.keys(columnIndex).length === 0) return instruments;

  // Traiter les lignes de données
  const rows = table.find('tbody tr');
  rows.each((_, row) => {
    try {
      const $row = $(row);
      const cells = $row.find('td').toArray().map((el) => cleanText($(el).text()));

      const codeIdx = columnIndex['code'];
      const desigIdx = columnIndex['designation'];
      const paysIdx = columnIndex['pays'];
      const sectIdx = columnIndex['secteur'];
      const typeIdx = columnIndex['type'];
      const statIdx = columnIndex['statut'];
      const isinIdx = columnIndex['isin'];

      const code = codeIdx !== undefined ? cells[codeIdx]?.trim().toUpperCase() : undefined;
      const designation = desigIdx !== undefined ? cells[desigIdx]?.trim() : undefined;

      if (!code || !designation) return;

      instruments.push({
        code,
        designation,
        pays: paysIdx !== undefined ? (cells[paysIdx]?.trim() ?? '') : '',
        secteur: sectIdx !== undefined ? (cells[sectIdx]?.trim() ?? '') : '',
        type: typeIdx !== undefined ? (cells[typeIdx]?.trim() ?? '') : '',
        statut: statIdx !== undefined ? (cells[statIdx]?.trim() ?? '') : '',
        isin: isinIdx !== undefined ? cells[isinIdx]?.trim() : undefined,
        scraped_at: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      // Ignorer les lignes malformées
    }
  });

  return instruments;
}

/**
 * Parse les activités de marché BDFIN (actions et obligations).
 * Retourne un objet BdfinMarketData avec les deux tableaux et résumé.
 */
export function parseBdfinMarketActivities(html: string, dateMarche: string): BdfinMarketData {
  const $ = cheerio.load(html);
  const data: BdfinMarketData = {
    date_marche: dateMarche,
    actions: [],
    obligations: [],
    summary: {
      valeur_transactions: 0,
      capitalisation_actions: 0,
      capitalisation_obligations: 0,
    },
  };

  // Parse tableau actions
  const actionsTable = $(MARKET_TABLE_SELECTORS.actionsTable).first();
  if (actionsTable.length) {
    const headerRow = actionsTable.find(MARKET_TABLE_SELECTORS.header).first();
    if (headerRow.length) {
      const headers = headerRow
        .find('th')
        .toArray()
        .map((el) => normalizeHeader($(el).text()));

      const columnIndex = buildColumnIndex(headers, MARKET_COLUMN_SPEC);
      const rows = actionsTable.find('tbody tr');

      rows.each((_, row) => {
        try {
          const $row = $(row);
          const cells = $row.find('td').toArray().map((el) => cleanText($(el).text()));

          const codeIdx = columnIndex['code'];
          if (codeIdx === undefined) return;
          const code = cells[codeIdx]?.trim().toUpperCase();
          if (!code) return;

          const desigIdx = columnIndex['designation'];
          const coursJourIdx = columnIndex['cours_jour'];
          const coursPrecedentIdx = columnIndex['cours_precedent'];
          const variationPctIdx = columnIndex['variation_pct'];
          const volumeIdx = columnIndex['volume'];
          const nbTransIdx = columnIndex['nb_transactions'];
          const valeurEchIdx = columnIndex['valeur_echangee'];

          const coursJour = coursJourIdx !== undefined ? parseFrNumber(cells[coursJourIdx]) : null;
          const coursPrecedent = coursPrecedentIdx !== undefined ? parseFrNumber(cells[coursPrecedentIdx]) : null;
          const variationPct = variationPctIdx !== undefined ? parseFrNumber(cells[variationPctIdx]) : null;
          const volume = volumeIdx !== undefined ? parseFrInt(cells[volumeIdx]) : null;
          const nbTransactions = nbTransIdx !== undefined ? parseFrInt(cells[nbTransIdx]) : null;
          const valeurEchangee = valeurEchIdx !== undefined ? parseFrNumber(cells[valeurEchIdx]) : null;

          data.actions.push({
            code,
            designation: desigIdx !== undefined ? (cells[desigIdx]?.trim() ?? '') : '',
            cours_jour: coursJour ?? 0,
            cours_precedent: coursPrecedent ?? 0,
            variation_pct: variationPct ?? 0,
            volume: volume ?? 0,
            nb_transactions: nbTransactions ?? 0,
            valeur_echangee: valeurEchangee ?? 0,
          });
        } catch (err) {
          // Ignorer les lignes malformées
        }
      });
    }
  }

  // Parse tableau obligations (même structure)
  const obligationsTable = $(MARKET_TABLE_SELECTORS.obligationsTable).first();
  if (obligationsTable.length) {
    const headerRow = obligationsTable.find(MARKET_TABLE_SELECTORS.header).first();
    if (headerRow.length) {
      const headers = headerRow
        .find('th')
        .toArray()
        .map((el) => normalizeHeader($(el).text()));

      const columnIndex = buildColumnIndex(headers, MARKET_COLUMN_SPEC);
      const rows = obligationsTable.find('tbody tr');

      rows.each((_, row) => {
        try {
          const $row = $(row);
          const cells = $row.find('td').toArray().map((el) => cleanText($(el).text()));

          const codeIdx = columnIndex['code'];
          if (codeIdx === undefined) return;
          const code = cells[codeIdx]?.trim().toUpperCase();
          if (!code) return;

          const desigIdx = columnIndex['designation'];
          const coursJourIdx = columnIndex['cours_jour'];
          const coursPrecedentIdx = columnIndex['cours_precedent'];
          const variationPctIdx = columnIndex['variation_pct'];
          const volumeIdx = columnIndex['volume'];
          const nbTransIdx = columnIndex['nb_transactions'];
          const valeurEchIdx = columnIndex['valeur_echangee'];

          const coursJour = coursJourIdx !== undefined ? parseFrNumber(cells[coursJourIdx]) : null;
          const coursPrecedent = coursPrecedentIdx !== undefined ? parseFrNumber(cells[coursPrecedentIdx]) : null;
          const variationPct = variationPctIdx !== undefined ? parseFrNumber(cells[variationPctIdx]) : null;
          const volume = volumeIdx !== undefined ? parseFrInt(cells[volumeIdx]) : null;
          const nbTransactions = nbTransIdx !== undefined ? parseFrInt(cells[nbTransIdx]) : null;
          const valeurEchangee = valeurEchIdx !== undefined ? parseFrNumber(cells[valeurEchIdx]) : null;

          data.obligations.push({
            code,
            designation: desigIdx !== undefined ? (cells[desigIdx]?.trim() ?? '') : '',
            cours_jour: coursJour ?? 0,
            cours_precedent: coursPrecedent ?? 0,
            variation_pct: variationPct ?? 0,
            volume: volume ?? 0,
            nb_transactions: nbTransactions ?? 0,
            valeur_echangee: valeurEchangee ?? 0,
          });
        } catch (err) {
          // Ignorer les lignes malformées
        }
      });
    }
  }

  // Extraire les statistiques de résumé (si présentes)
  const summarySelectors = ['div.summary-stats', 'div[id*="Summary"]', 'span[id*="TotalValue"]'];
  for (const sel of summarySelectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text();
      const valMatch = text.match(/(\d+[\s.,]*)+/);
      if (valMatch) {
        const valStr = valMatch[0];
        const parsed = parseFrNumber(valStr);
        if (parsed !== null) {
          data.summary.valeur_transactions = parsed;
        }
      }
      break;
    }
  }

  return data;
}
