import * as cheerio from 'cheerio';
import { parseFrDate } from '../utils/dates.js';
import type { ParsedNotation } from './types.js';

export function parseNotationPage(html: string, sourceUrl: string): ParsedNotation | null {
  const $ = cheerio.load(html);

  let agence = '';
  let note = '';
  let perspective = '';
  let dateRaw = '';

  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const label = $(cells[0]).text().trim().toLowerCase();
    const value = $(cells[1]).text().trim();

    if (!agence && (label.includes('agence') || label.includes('organisme'))) agence = value;
    if (!note && (label.includes('note') || label.includes('rating'))) note = value;
    if (!perspective && (label.includes('perspective') || label.includes('outlook'))) perspective = value;
    if (!dateRaw && (label.includes('date') || label.includes('mise à jour'))) dateRaw = value;
  });

  if (!note) {
    $('[class*="note"], [class*="rating"], [class*="notation"]').each((_, el) => {
      const text = $(el).text().trim();
      if (/^[A-D][+-]?$/.test(text) || /^[A-D]{1,3}[+-]?\d?$/.test(text)) {
        note = text;
        return false as unknown as void;
      }
    });
  }

  if (!note) return null;

  const date_notation = parseFrDate(dateRaw) ?? new Date().toISOString().slice(0, 10);

  return {
    agence: agence || 'Inconnu',
    note,
    perspective: perspective || 'N/D',
    date_notation,
    source_url: sourceUrl,
  };
}
