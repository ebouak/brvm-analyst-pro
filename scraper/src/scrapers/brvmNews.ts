import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { logger } from '../logger.js';

const log = logger.child({ module: 'brvmNews' });

export interface NewsItem {
  dedupe_hash: string;
  titre: string;
  date_publication: string; // YYYY-MM-DD
  source: 'brvm' | 'cosumaf';
  source_url: string | null;
  resume: string | null;
  instrument_code: string | null;
}

function hashItem(titre: string, date: string, source: string): string {
  return createHash('sha256').update(`${titre}|${date}|${source}`).digest('hex');
}

const MOIS: Record<string, string> = {
  janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
};

function parseDate(raw: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0]!;
  const fr = raw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (fr) return `${fr[3]}-${fr[2]!.padStart(2, '0')}-${fr[1]!.padStart(2, '0')}`;
  const litteral = raw.toLowerCase().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (litteral) {
    const m = MOIS[litteral[2]!];
    if (m) return `${litteral[3]}-${m}-${litteral[1]!.padStart(2, '0')}`;
  }
  return today;
}

async function scrapeBrvmActualites(): Promise<NewsItem[]> {
  const url = 'https://www.brvm.org/fr/actualites';
  try {
    const { data } = await axios.get<string>(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystBot/1.0)' },
    });
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];
    $('article, .news-item, .actualite-item, [class*="article"]').each((_, el) => {
      const titre = $(el).find('h2, h3, .titre, [class*="title"]').first().text().trim();
      const dateRaw = $(el).find('time, .date, [class*="date"]').first().text().trim();
      const lien = $(el).find('a').first().attr('href');
      const resume = $(el).find('p, .resume, [class*="excerpt"]').first().text().trim().slice(0, 500);
      if (!titre || titre.length < 5) return;
      const date = parseDate(dateRaw);
      const source_url = lien
        ? lien.startsWith('http') ? lien : `https://www.brvm.org${lien}`
        : null;
      items.push({
        dedupe_hash: hashItem(titre, date, 'brvm'),
        titre,
        date_publication: date,
        source: 'brvm',
        source_url,
        resume: resume || null,
        instrument_code: null,
      });
    });
    log.info({ count: items.length }, 'BRVM actualités scrapées');
    return items;
  } catch (err) {
    log.warn({ err }, 'Échec scraping brvm.org/actualites');
    return [];
  }
}

async function scrapeCosumaf(): Promise<NewsItem[]> {
  const url = 'https://www.cosumaf.org/actualites';
  try {
    const { data } = await axios.get<string>(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystBot/1.0)' },
    });
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];
    $('article, .actualite, [class*="news"], [class*="article"]').each((_, el) => {
      const titre = $(el).find('h2, h3, .titre, [class*="title"]').first().text().trim();
      const dateRaw = $(el).find('time, .date, [class*="date"]').first().text().trim();
      const lien = $(el).find('a').first().attr('href');
      const resume = $(el).find('p, .resume').first().text().trim().slice(0, 500);
      if (!titre || titre.length < 5) return;
      const date = parseDate(dateRaw);
      const source_url = lien
        ? lien.startsWith('http') ? lien : `https://www.cosumaf.org${lien}`
        : null;
      items.push({
        dedupe_hash: hashItem(titre, date, 'cosumaf'),
        titre,
        date_publication: date,
        source: 'cosumaf',
        source_url,
        resume: resume || null,
        instrument_code: null,
      });
    });
    log.info({ count: items.length }, 'COSUMAF actualités scrapées');
    return items;
  } catch (err) {
    log.warn({ err }, 'Échec scraping cosumaf.org');
    return [];
  }
}

export async function scrapeAllNews(): Promise<NewsItem[]> {
  const [brvm, cosumaf] = await Promise.all([scrapeBrvmActualites(), scrapeCosumaf()]);
  return [...brvm, ...cosumaf];
}
