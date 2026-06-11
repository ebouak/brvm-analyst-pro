/**
 * Scraper des actualités du marché BRVM depuis sikafinance.com.
 *
 * Source calibrée sur le markup réel (juin 2026) :
 *  - Page liste : https://www.sikafinance.com/marches/actualites_bourse_brvm
 *  - Conteneur  : <ul class="news-feed"> > <li>
 *      · a.news-title  → titre + href (slug se terminant par _<id>)
 *      · .news-chapeau → résumé
 *      · time.news-date[datetime] → date ISO
 *  - Communiqués des sociétés : /marches/communiques_brvm (même structure)
 *
 * Le SCRAPER peut lire des sources externes ; le FRONTEND reste Supabase-only.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { logger } from '../logger.js';
import type { NewsItem } from './brvmNews.js';

const log = logger.child({ module: 'sikaNews' });

const BASE = 'https://www.sikafinance.com';
const SOURCES: Array<{ url: string; label: string }> = [
  { url: `${BASE}/marches/actualites_bourse_brvm`, label: 'actualités' },
  { url: `${BASE}/marches/communiques_brvm`, label: 'communiqués' },
];

function hashItem(idOrTitre: string): string {
  return createHash('sha256').update(`sika|${idOrTitre}`).digest('hex');
}

/** Extrait l'identifiant numérique en fin de slug (…-titre_62192 → 62192). */
function slugId(href: string): string | null {
  const m = href.match(/_(\d+)(?:\.[a-z]+)?$/i);
  return m ? m[1]! : null;
}

/** Normalise la date : datetime ISO de <time> ou fallback aujourd'hui. */
function parseDate(raw: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0]!;
  const fr = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fr) return `${fr[3]}-${fr[2]!.padStart(2, '0')}-${fr[1]!.padStart(2, '0')}`;
  return today;
}

async function scrapeFeed(url: string, label: string): Promise<NewsItem[]> {
  try {
    const { data } = await axios.get<string>(url, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' },
      responseType: 'text',
    });
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    $('ul.news-feed > li').each((_, li) => {
      const a = $(li).find('a.news-title').first();
      const titre = a.text().replace(/\s+/g, ' ').trim();
      let href = a.attr('href') ?? $(li).find('a.news-thumb').first().attr('href') ?? '';
      if (!titre || titre.length < 8 || !href) return;
      if (!href.startsWith('http')) href = `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;

      const id = slugId(href);
      const key = id ?? titre;
      if (seen.has(key)) return;
      seen.add(key);

      const resume = $(li).find('.news-chapeau').first().text().replace(/\s+/g, ' ').trim() || null;
      const dateAttr = $(li).find('time.news-date').first().attr('datetime')
        ?? $(li).find('time.news-date').first().text().trim();

      items.push({
        dedupe_hash: hashItem(key),
        titre,
        date_publication: parseDate(dateAttr),
        source: 'brvm',
        source_url: href,
        resume: resume && resume.length > 5 ? resume.slice(0, 500) : null,
        instrument_code: null,
      });
    });

    log.info({ count: items.length, label }, 'Sika Finance : actualités parsées');
    return items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ err: msg, url, label }, 'Échec scraping Sika Finance');
    return [];
  }
}

/** Récupère actualités + communiqués BRVM depuis Sika Finance. */
export async function scrapeSikaNews(): Promise<NewsItem[]> {
  const batches = await Promise.all(SOURCES.map((s) => scrapeFeed(s.url, s.label)));
  // Dédup par dedupe_hash (un même article peut figurer dans deux fils).
  const byHash = new Map<string, NewsItem>();
  for (const item of batches.flat()) {
    if (!byHash.has(item.dedupe_hash)) byHash.set(item.dedupe_hash, item);
  }
  const all = [...byHash.values()];
  log.info({ total: all.length }, 'Sika Finance : actualités consolidées');
  return all;
}
