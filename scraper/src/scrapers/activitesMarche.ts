/**
 * Scraper de la page Activites_marche.aspx.
 *
 * Récupère le HTML authentifié, le parse en actions/obligations/indices,
 * et calcule le hash source. Peut cibler une date précise via postback
 * (sélecteur de date du formulaire ASP.NET) si la page le permet.
 */
import type { HttpClient } from '../client/http.js';
import { getAuthenticated } from '../client/auth.js';
import {
  extractAspNetState,
  buildPostback,
  looksLikeLoginPage,
} from '../client/aspnet.js';
import { getConfig } from '../config.js';
import { parseActions } from '../parsers/actions.js';
import { parseObligations } from '../parsers/obligations.js';
import { parseIndices } from '../parsers/indices.js';
import { sha256 } from '../utils/hash.js';
import { todayMarketDate } from '../utils/dates.js';
import { logger } from '../logger.js';
import type { MarketSnapshot, MarketDate } from '../types.js';

/**
 * Noms des contrôles du formulaire de sélection de date (à calibrer).
 * Beaucoup de pages BDFIN affichent par défaut la dernière séance ; pour
 * l'historique, un postback sur le calendrier/bouton est nécessaire.
 */
export const MARKET_DATE_FIELDS = {
  dateInput: 'ctl00$ContentPlaceHolder1$txtDate',
  submit: 'ctl00$ContentPlaceHolder1$btnAfficher',
  submitValue: 'Afficher',
} as const;

function snapshotFromHtml(html: string, date: MarketDate): MarketSnapshot {
  return {
    date_marche: date,
    actions: parseActions(html),
    obligations: parseObligations(html),
    indices: parseIndices(html),
    hash_source: sha256(html),
    is_mock: false,
  };
}

/** Scrape la séance courante (dernière séance publiée). */
export async function scrapeLatest(http: HttpClient): Promise<MarketSnapshot> {
  const cfg = getConfig();
  const html = await getAuthenticated(http, cfg.BDFIN_MARKET_PATH);
  const snap = snapshotFromHtml(html, todayMarketDate());
  logger.info(
    {
      actions: snap.actions.length,
      obligations: snap.obligations.length,
      indices: snap.indices.length,
    },
    'Snapshot séance courante construit',
  );
  return snap;
}

/**
 * Scrape une date précise via postback du formulaire de date.
 * Format de date attendu par BDFIN : à confirmer (souvent jj/mm/aaaa).
 */
export async function scrapeDate(
  http: HttpClient,
  date: MarketDate,
): Promise<MarketSnapshot> {
  const cfg = getConfig();

  // 1) Charger la page pour récupérer l'état ASP.NET courant.
  const firstHtml = await getAuthenticated(http, cfg.BDFIN_MARKET_PATH);
  const state = extractAspNetState(firstHtml);

  // 2) Convertir la date ISO -> jj/mm/aaaa pour le champ du formulaire.
  const [y, m, d] = date.split('-');
  const frDate = `${d}/${m}/${y}`;

  const form = buildPostback(state, MARKET_DATE_FIELDS.submit, '', {
    [MARKET_DATE_FIELDS.dateInput]: frDate,
    [MARKET_DATE_FIELDS.submit]: MARKET_DATE_FIELDS.submitValue,
  });

  logger.info({ date, frDate }, 'Postback sélection de date');
  const resp = await http.postForm(cfg.BDFIN_MARKET_PATH, form);

  if (looksLikeLoginPage(resp.data)) {
    throw new Error(
      `Session perdue pendant le postback date ${date}. Reconnexion requise.`,
    );
  }

  const snap = snapshotFromHtml(resp.data, date);
  logger.info(
    {
      date,
      actions: snap.actions.length,
      obligations: snap.obligations.length,
      indices: snap.indices.length,
    },
    'Snapshot daté construit',
  );
  return snap;
}
