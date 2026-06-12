// scraper/src/scrapers/bulletins.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { logger } from '../logger.js';

const log = logger.child({ module: 'scrapers:bulletins' });
const BASE = 'https://www.brvm.org';
const LIST = `${BASE}/fr/bulletins-officiels-de-la-cote`;
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' };
const MAX_ITEMS = 20;

function hashItem(url: string): string {
  return createHash('sha256').update(`bulletins|${url}`).digest('hex');
}

export interface Bulletin {
  dedupe_hash: string;
  date_bulletin: string;
  numero?: string;
  source_url: string;
  document_url?: string;
  resume?: string;
}

async function fetchBulletin(href: string): Promise<Bulletin | null> {
  const url = href.startsWith('http') ? href : `${BASE}${href}`;
  try {
    const { data } = await axios.get<string>(url, { timeout: 25000, headers: H, responseType: 'text' });
    const $ = cheerio.load(data);

    const bodyText = $('article, .content, .field-name-body').first().text();
    const dateMatch = bodyText.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);

    if (!dateMatch) {
      log.warn({ url }, 'No date found in bulletin');
      return null;
    }

    const date = `${dateMatch[3]!}-${getMonthNumber(dateMatch[2]!)}-${String(dateMatch[1]!).padStart(2, '0')}`;
    const resume = $('p').first().text().replace(/\s+/g, ' ').trim().slice(0, 500);
    const pdfLink = $('a[href$=".pdf"]').first().attr('href');

    return {
      dedupe_hash: hashItem(href),
      date_bulletin: date,
      source_url: url,
      document_url: pdfLink ? (pdfLink.startsWith('http') ? pdfLink : `${BASE}${pdfLink}`) : undefined,
      resume: resume || undefined,
    };
  } catch (err) {
    log.warn({ url, err: err instanceof Error ? err.message : String(err) }, 'Bulletin fetch failed');
    return null;
  }
}

function getMonthNumber(monthName: string): string {
  const months: Record<string, string> = {
    janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
    juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
  };
  return months[monthName.toLowerCase()] || '01';
}

export async function scrapeBulletins(): Promise<Bulletin[]> {
  try {
    const { data } = await axios.get<string>(LIST, { timeout: 25000, headers: H, responseType: 'text' });
    const $ = cheerio.load(data);
    const hrefs = new Set<string>();

    $('a[href*="/bulletins"]').each((_, a) => {
      const h = $(a).attr('href');
      if (h && /\/bulletins.*/.test(h)) hrefs.add(h);
    });

    const targets = [...hrefs].slice(0, MAX_ITEMS);
    const items = (await Promise.all(targets.map(fetchBulletin)))
      .filter((x): x is Bulletin => x !== null);

    log.info({ count: items.length }, 'Bulletins scraped');
    return items;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Bulletins scrape failed');
    return [];
  }
}
