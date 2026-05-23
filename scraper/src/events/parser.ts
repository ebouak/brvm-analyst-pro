/**
 * Parser générique d'une page de listing brvm.org (communiqués, avis,
 * informations permanentes). Le markup réel doit être calibré (sélecteurs
 * ci-dessous) — la structure exacte des listes brvm.org est à confirmer.
 */
import * as cheerio from 'cheerio';
import type { MarketEvent, EventSourceType } from './types.js';
import { classifyEventType, guessSentiment } from './classify.js';
import { parseFrDate } from '../utils/dates.js';
import { cleanText } from '../utils/parseNumber.js';
import { logger } from '../logger.js';

/** Sélecteurs candidats pour les items de listing (à calibrer). */
const ITEM_SELECTORS = [
  '.views-row',
  '.list-item',
  'article',
  'table tr',
];

export function parseEventList(
  html: string,
  sourceType: EventSourceType,
  baseUrl: string,
): MarketEvent[] {
  const $ = cheerio.load(html);
  const out: MarketEvent[] = [];

  let items = $('');
  for (const sel of ITEM_SELECTORS) {
    items = $(sel);
    if (items.length > 0) break;
  }

  items.each((_, el) => {
    const node = $(el);
    const title = cleanText(node.find('a, h2, h3, td').first().text());
    if (!title) return;

    const href = node.find('a').first().attr('href') ?? null;
    const dateText = cleanText(
      node.find('time, .date, .field--name-created, td').last().text(),
    );
    const date = parseFrDate(dateText);
    if (!date) return; // sans date fiable, on ignore (qualité)

    const summary = cleanText(node.find('p, .field--type-text-long').first().text()) || null;
    out.push({
      event_date: date,
      event_datetime: null,
      source: 'BRVM',
      source_url: href ? new URL(href, baseUrl).toString() : null,
      source_type: sourceType,
      title,
      summary,
      event_type: classifyEventType(title),
      issuer_name: null,
      instrument_code: null,
      sector: null,
      country_code: null,
      importance_level: null,
      sentiment: guessSentiment(title, summary),
      tags: null,
      related_codes: [],
    });
  });

  logger.info({ sourceType, count: out.length }, 'Événements parsés');
  return out;
}
