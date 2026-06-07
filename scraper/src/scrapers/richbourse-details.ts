import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';

export interface RichbourseDetail {
  code: string;
  date_marche: string;
  ouverture: number | null;
  plus_haut: number | null;
  plus_bas: number | null;
  flottant: number | null;
  vol_moyen: number | null;
}

const BASE = 'https://www.richbourse.com';

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
void sleep; // used by runDetails

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const clean = s.replace(/[\s ]/g, '').replace(/,/g, '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseRow($: cheerio.CheerioAPI, label: string): number | null {
  let val: number | null = null;
  $('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;
    const key = $(cells[0]).text().trim().toLowerCase();
    if (key.includes(label.toLowerCase())) {
      val = parseNum($(cells[1]).text().trim());
      return false;
    }
  });
  return val;
}

export async function scrapeDetails(code: string): Promise<RichbourseDetail | null> {
  const url = `${BASE}/common/mouvements/index/${code}`;
  try {
    const { data: html } = await axios.get<string>(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVM-Analyst/1.0)' },
      timeout: 15_000,
      responseType: 'text',
    });
    const $ = cheerio.load(html);

    let dateMarche = new Date().toISOString().slice(0, 10);
    $('h2, h3, .titre, .date-seance').each((_, el) => {
      const m = $(el).text().match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) { dateMarche = `${m[3]}-${m[2]}-${m[1]}`; return false; }
    });

    const ouverture = parseRow($, 'ouverture');
    const plus_haut = parseRow($, 'plus haut');
    const plus_bas  = parseRow($, 'plus bas');
    const flottant  = parseRow($, 'flottant');
    const vol_moyen = parseRow($, 'volume moyen');

    logger.info({ code, ouverture, plus_haut, plus_bas }, 'Détails richbourse');
    return { code, date_marche: dateMarche, ouverture, plus_haut, plus_bas, flottant, vol_moyen };
  } catch (e) {
    logger.warn({ code, err: (e as Error).message }, 'scrapeDetails échoué');
    return null;
  }
}
