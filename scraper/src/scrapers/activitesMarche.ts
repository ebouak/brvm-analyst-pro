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
/**
 * Sélecteur de séance sur Activites_marche.aspx : c'est un <select> ASP.NET
 * (AutoPostBack) dont les valeurs d'option sont au format YYYYMMDD
 * (ex. « 20260612 » = 12/06/2026). Le changement de date se fait par postback
 * avec __EVENTTARGET = nom du déroulant. (Calibré sur le markup réel 2026-06-14.)
 */
export const MARKET_DATE_FIELDS = {
  dateSelect: 'ctl00$Main$DropDownList1',
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

  // 2) Valeur d'option du déroulant = YYYYMMDD ; postback via __EVENTTARGET.
  const ymd = date.replace(/-/g, '');

  const form = buildPostback(state, MARKET_DATE_FIELDS.dateSelect, '', {
    [MARKET_DATE_FIELDS.dateSelect]: ymd,
  });

  logger.info({ date, ymd }, 'Postback sélection de date');
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
