// scraper/src/scrapers/communiques.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { logger } from '../logger.js';
import type { NewsItem } from './brvmNews.js';

const log = logger.child({ module: 'scrapers:communiques' });
const BASE = 'https://www.brvm.org';
const LIST = `${BASE}/fr/emetteurs/type-annonces/communiques`;
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' };
const MAX_ITEMS = 20;

function hashItem(url: string): string {
  return createHash('sha256').update(`communiques|${url}`).digest('hex');
}

export interface Communique {
  dedupe_hash: string;
  titre: string;
  date_publication: string;
  emetteur?: string;
  categorie: string;
  source_url: string;
  document_url?: string;
  resume?: string;
}

async function fetchCommunique(href: string): Promise<Communique | null> {
  const url = href.startsWith('http') ? href : `${BASE}${href}`;
  try {
    const { data } = await axios.get<string>(url, { timeout: 25000, headers: H, responseType: 'text' });
    const $ = cheerio.load(data);
    const titre = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (!titre || titre.length < 5) return null;

    const bodyText = $('article, .content, .field-name-body').first().text();
    const dateMatch = bodyText.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
    const date = dateMatch ? `${dateMatch[3]!}-${getMonthNumber(dateMatch[2]!)}-${String(dateMatch[1]!).padStart(2, '0')}` : new Date().toISOString().slice(0, 10);

    const resume = $('p').first().text().replace(/\s+/g, ' ').trim().slice(0, 500);

    return {
      dedupe_hash: hashItem(href),
      titre,
      date_publication: date,
      emetteur: $('span[class*="emetteur"]').text().trim() || undefined,
      categorie: 'communique',
      source_url: url,
      resume: resume || undefined,
    };
  } catch (err) {
    log.warn({ url, err: err instanceof Error ? err.message : String(err) }, 'Communique fetch failed');
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

export async function scrapeCommuniques(): Promise<Communique[]> {
  try {
    const { data } = await axios.get<string>(LIST, { timeout: 25000, headers: H, responseType: 'text' });
    const $ = cheerio.load(data);
    const hrefs = new Set<string>();

    $('a[href*="/emetteurs/"]').each((_, a) => {
      const h = $(a).attr('href');
      if (h && /\/emetteurs\/.*communique/.test(h)) hrefs.add(h);
    });

    const targets = [...hrefs].slice(0, MAX_ITEMS);
    const items = (await Promise.all(targets.map(fetchCommunique)))
      .filter((x): x is Communique => x !== null);

    log.info({ count: items.length }, 'Communiques scraped');
    return items;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Communiques scrape failed');
    return [];
  }
}
