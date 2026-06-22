/**
 * Actualités officielles depuis brvm.org (site Drupal de la BRVM).
 *
 * Calibré (juin 2026) :
 *  - Liste : https://www.brvm.org/fr/mediacentre/actualites
 *      → ancres /fr/mediacentre/actualites/<slug> (titres affichés « Lire plus »)
 *  - Article : <h1> = titre, 1er <p> du corps = résumé, date littérale dans le texte.
 *
 * brvm.org a une chaîne TLS incomplète → le scraper tourne avec
 * NODE_TLS_REJECT_UNAUTHORIZED=0 (déjà le cas via les scripts npm / polyfills).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { logger } from '../logger.js';
import type { NewsItem } from './brvmNews.js';

const log = logger.child({ module: 'brvmOrgNews' });
const BASE = 'https://www.brvm.org';
const LIST = `${BASE}/fr/mediacentre/actualites`;
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' };
const MAX_ARTICLES = 12;

const MOIS: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', août: '08', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
};

function parseDateFromText(text: string): string | null {
  const m = text.toLowerCase().match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/);
  if (!m) return null;
  const mois = MOIS[m[2]!];
  return mois ? `${m[3]}-${mois}-${m[1]!.padStart(2, '0')}` : null;
}

/** Une date de publication ne peut pas être dans le futur : on la rejette sinon. */
function notFuture(date: string | null): string | null {
  if (!date) return null;
  return date <= new Date().toISOString().slice(0, 10) ? date : null;
}

/**
 * Date de publication réelle de l'article, par ordre de fiabilité :
 *  1) attribut <time datetime="…"> (ISO) ;
 *  2) élément de date Drupal (.date-display-single / .submitted / .post-date) ;
 *  3) première date littérale du corps — UNIQUEMENT si elle n'est pas future
 *     (évite de capter une date d'échéance citée dans le texte) ;
 *  4) repli : aujourd'hui.
 */
function extractPublicationDate($: cheerio.CheerioAPI, bodyText: string): string {
  const iso = $('time[datetime]').first().attr('datetime');
  if (iso) {
    const d = iso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && notFuture(d)) return d;
  }
  const meta = $('.date-display-single, .submitted, .field-name-post-date, .node__meta time')
    .first().text();
  const fromMeta = notFuture(parseDateFromText(meta));
  if (fromMeta) return fromMeta;

  const fromBody = notFuture(parseDateFromText(bodyText));
  if (fromBody) return fromBody;

  return new Date().toISOString().slice(0, 10);
}

function hashItem(slug: string): string {
  return createHash('sha256').update(`brvmorg|${slug}`).digest('hex');
}

async function fetchArticle(href: string): Promise<NewsItem | null> {
  const url = href.startsWith('http') ? href : `${BASE}${href}`;
  try {
    const { data } = await axios.get<string>(url, { timeout: 25000, headers: H, responseType: 'text' });
    const $ = cheerio.load(data);
    const titre = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (!titre || titre.length < 5) return null;
    const para = $('.field-name-body p, .content p, article p, .region-content p')
      .first().text().replace(/\s+/g, ' ').trim();
    const bodyText = $('.field-name-body, .region-content, article').first().text();
    const date = extractPublicationDate($, bodyText);
    const slug = href.split('/').filter(Boolean).pop() ?? href;
    // og:image de l'article (illustration) si disponible.
    const ogImage = $('meta[property="og:image"]').first().attr('content')
      ?? $('meta[name="twitter:image"]').first().attr('content') ?? null;
    const imageUrl = ogImage && /^https?:\/\//i.test(ogImage)
      ? ogImage
      : ogImage ? `${BASE}${ogImage.startsWith('/') ? '' : '/'}${ogImage}` : null;
    return {
      dedupe_hash: hashItem(slug),
      titre,
      date_publication: date,
      source: 'brvm',
      source_url: url,
      resume: para && para.length > 5 ? para.slice(0, 500) : null,
      instrument_code: null,
      image_url: imageUrl,
    };
  } catch (err) {
    log.warn({ url, err: err instanceof Error ? err.message : String(err) }, 'article brvm.org échec');
    return null;
  }
}

/** Récupère les dernières actualités officielles de brvm.org. */
export async function scrapeBrvmOrgNews(): Promise<NewsItem[]> {
  try {
    const { data } = await axios.get<string>(LIST, { timeout: 25000, headers: H, responseType: 'text' });
    const $ = cheerio.load(data);
    const hrefs = new Set<string>();
    $('a[href*="/mediacentre/actualites/"]').each((_, a) => {
      const h = $(a).attr('href');
      if (h && /\/mediacentre\/actualites\/.+/.test(h)) hrefs.add(h);
    });
    const targets = [...hrefs].slice(0, MAX_ARTICLES);

    const items = (await Promise.all(targets.map(fetchArticle)))
      .filter((x): x is NewsItem => x !== null);
    log.info({ count: items.length, found: hrefs.size }, 'Actualités brvm.org récupérées');
    return items;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Échec liste brvm.org');
    return [];
  }
}
