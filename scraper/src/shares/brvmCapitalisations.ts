/**
 * Nombre d'actions par société depuis la page officielle des capitalisations
 * BRVM (brvm.org). La colonne « Nombre de titres » donne directement le nombre
 * d'actions en circulation (source autoritaire — pas d'estimation capi/cours).
 *
 * Mapping par libellé d'en-tête ; le code société est en première colonne.
 * NB : brvm.org a une chaîne TLS incomplète → le workflow pose
 * NODE_TLS_REJECT_UNAUTHORIZED=0 (le polyfill scraper le fait aussi).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import { parseFrInt } from '../utils/parseNumber.js';

const log = logger.child({ module: 'brvmCapitalisations' });
const URL = 'https://www.brvm.org/fr/capitalisations/0';

export interface SharesRow { code: string; shares: number; source: 'brvm.org'; }

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function parseCapitalisations(html: string): SharesRow[] {
  const $ = cheerio.load(html);
  const out: SharesRow[] = [];
  const seen = new Set<string>();

  $('table').each((_, tbl) => {
    const headers = $(tbl).find('tr').first().find('th,td').map((__, e) => normalize($(e).text())).get();
    const titresIdx = headers.findIndex((h) => h.includes('nombre de titres') || h === 'titres');
    if (titresIdx < 0) return; // pas la bonne table

    $(tbl).find('tbody tr').each((__, tr) => {
      const cells = $(tr).find('td').map((___, td) => $(td).text().trim()).get();
      if (cells.length <= titresIdx) return;
      const code = (cells[0] ?? '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
      const shares = parseFrInt(cells[titresIdx] ?? '');
      if (!code || code.length < 2 || seen.has(code)) return;
      if (shares == null || shares <= 0) return;
      seen.add(code);
      out.push({ code, shares, source: 'brvm.org' });
    });
  });

  log.info({ count: out.length }, 'Nombre de titres récupéré (brvm.org)');
  return out;
}

export async function fetchSharesFromBrvm(): Promise<SharesRow[]> {
  const res = await axios.get<string>(URL, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    responseType: 'text',
  });
  return parseCapitalisations(res.data);
}
