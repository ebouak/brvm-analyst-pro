import * as cheerio from 'cheerio';
import { parseFrDate } from '../utils/dates.js';
import type { ParsedNotation, NotationHistoryEntry } from './types.js';

// Table columns: Agence de notation | Date | Court terme | Long terme | Fichier
// We take up to the 3 most recent data rows (newest first in the table).
export function parseNotationPage(html: string, sourceUrl: string): ParsedNotation | null {
  const $ = cheerio.load(html);

  // Find the notation table by looking for a header with "Agence"
  let tableEl: cheerio.Cheerio<cheerio.Element> | null = null;
  $('table').each((_, tbl) => {
    const allTh = $(tbl).find('th').map((_, el) => $(el).text().toLowerCase()).toArray().join(' ');
    if (allTh.includes('agence')) {
      tableEl = $(tbl);
      return false as unknown as void;
    }
  });

  if (!tableEl) return null;

  const extractRating = (s: string) => s.split(/\s/)[0].replace(/[^A-Za-z0-9+\-]/g, '');
  const extractPerspective = (s: string) => {
    const m = s.match(/perspective\s+(\S+)/i);
    return m ? m[1] : 'Stable';
  };

  // Collect data rows (skip header)
  const history: NotationHistoryEntry[] = [];
  const rows = tableEl!.find('tr').toArray();

  for (const row of rows) {
    if (history.length >= 3) break;
    const cells = $(row).find('td');
    if (cells.length < 3) continue;

    const dateRaw = $(cells[1]).text().trim();
    const courtTermeStr = $(cells[2]).text().trim();
    const longTermeStr = cells.length >= 4 ? $(cells[3]).text().trim() : '';

    const primaryStr = longTermeStr || courtTermeStr;
    const note = extractRating(primaryStr);
    if (!note) continue;

    const date_notation = parseFrDate(dateRaw) ?? new Date().toISOString().slice(0, 10);

    history.push({
      note,
      court_terme: courtTermeStr || null,
      long_terme: longTermeStr || null,
      perspective: extractPerspective(primaryStr),
      date_notation,
    });
  }

  if (history.length === 0) return null;

  // Agence is shared across all rows (same agency per page)
  const agence = $(tableEl!.find('tr').toArray().find(r => $(r).find('td').length >= 3)!).find('td').first().text().trim() || 'Inconnu';

  const latest = history[0];

  return {
    agence,
    note: latest.note,
    perspective: latest.perspective,
    court_terme: latest.court_terme,
    long_terme: latest.long_terme,
    date_notation: latest.date_notation,
    source_url: sourceUrl,
    history,
  };
}
