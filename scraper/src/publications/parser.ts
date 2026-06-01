import * as cheerio from 'cheerio';
import { parseFrDate } from '../utils/dates.js';

export interface ParsedPubRow {
  date_publication: string;
  libelle: string;
  source_url: string | null;
}

export function parsePublicationsTable(html: string, baseUrl: string): ParsedPubRow[] {
  const $ = cheerio.load(html);
  const rows: ParsedPubRow[] = [];
  // Cherche toute table avec >= 3 colonnes (date, libellé, lien)
  $('table').each((_, table) => {
    $(table).find('tr').each((__, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 2) return;
      const dateText = $(tds[0]).text().trim();
      const libelle = $(tds[1]).text().trim();
      if (!dateText || !libelle) return;
      if (!/\d{2}\/\d{2}\/\d{4}/.test(dateText)) return; // skip header
      const date = parseFrDate(dateText);
      if (!date) return;
      let href: string | null = null;
      const link = $(tr).find('a').last();
      if (link.length) {
        const raw = link.attr('href');
        if (raw) {
          try { href = new URL(raw, baseUrl).href; } catch { href = null; }
        }
      }
      rows.push({ date_publication: date, libelle, source_url: href });
    });
  });
  // Dédupe
  const seen = new Set<string>();
  return rows.filter(r => {
    const key = `${r.date_publication}|${r.libelle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
