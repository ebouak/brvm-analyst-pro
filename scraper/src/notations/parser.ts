import * as cheerio from 'cheerio';
import type { ParsedNotation, NotationHistoryEntry } from './types.js';

const FR_MONTHS: Record<string, string> = {
  janvier: '01', février: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', août: '08',
  septembre: '09', octobre: '10', novembre: '11', décembre: '12',
};

// Parses "Juin 2025", "Août 2023", etc. → "2025-06-01"
function parseFrMonthYear(raw: string): string {
  const parts = raw.trim().toLowerCase().split(/\s+/);
  if (parts.length === 2) {
    const month = FR_MONTHS[parts[0]!];
    const year = parts[1];
    if (month && year && /^\d{4}$/.test(year)) {
      return `${year}-${month}-01`;
    }
  }
  // fallback: today
  return new Date().toISOString().slice(0, 10);
}

// Extract the short rating token (e.g. "AA+" from "AA+ perspective Stable")
function extractRating(s: string): string {
  return s.split(/\s/)[0]?.replace(/[^A-Za-z0-9+\-]/g, '') ?? '';
}

function extractPerspective(s: string): string {
  const m = s.match(/perspective\s+(\S+)/i);
  return m ? m[1]! : 'Stable';
}

// Table columns: Agence de notation | Date | Court terme | Long terme | Fichier
// Returns up to 3 most recent entries (newest first, as they appear in the table).
export function parseNotationPage(html: string, sourceUrl: string): ParsedNotation | null {
  const $ = cheerio.load(html);

  // Find table with "agence" in its headers
  let tableEl: cheerio.Cheerio<cheerio.Element> | null = null;
  $('table').each((_, tbl) => {
    const allTh = $(tbl).find('th').map((_, el) => $(el).text().toLowerCase()).toArray().join(' ');
    if (allTh.includes('agence')) {
      tableEl = $(tbl);
      return false as unknown as void;
    }
  });

  if (!tableEl) return null;

  const history: NotationHistoryEntry[] = [];
  let agence = '';

  for (const row of tableEl!.find('tr').toArray()) {
    if (history.length >= 3) break;
    const cells = $(row).find('td');
    if (cells.length < 3) continue;

    const rowAgence = $(cells[0]).text().trim();
    if (!agence && rowAgence) agence = rowAgence;

    const dateRaw = $(cells[1]).text().trim();
    const courtTermeStr = $(cells[2]).text().trim();
    const longTermeStr = cells.length >= 4 ? $(cells[3]).text().trim() : '';

    const primaryStr = longTermeStr || courtTermeStr;
    const note = extractRating(primaryStr);
    if (!note) continue;

    history.push({
      note,
      court_terme: courtTermeStr || null,
      long_terme: longTermeStr || null,
      perspective: extractPerspective(primaryStr),
      date_notation: parseFrMonthYear(dateRaw),
    });
  }

  if (history.length === 0) return null;

  const latest = history[0]!;

  return {
    agence: agence || 'Inconnu',
    note: latest.note,
    perspective: latest.perspective,
    court_terme: latest.court_terme,
    long_terme: latest.long_terme,
    date_notation: latest.date_notation,
    source_url: sourceUrl,
    history,
  };
}
