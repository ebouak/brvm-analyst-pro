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
import * as cheerio from 'cheerio';
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

/**
 * Date de la séance AFFICHÉE, lue sur la page : option sélectionnée du
 * déroulant de séance (valeur YYYYMMDD). Null si le déroulant ou sa sélection
 * manque, ou si la valeur n'a pas la forme attendue.
 *
 * POURQUOI. `scrapeLatest` datait la séance avec « aujourd'hui ». Le
 * 2026-09-21 à 06:02 UTC (relance manuelle, marché fermé), la page affichait
 * encore la clôture du vendredi 18 : 44 lignes de clôture ont été écrites
 * sous la date du lundi 21 — une séance fantôme, identique à la précédente.
 * Même famille de défaut que celle corrigée pour runDetails (« preuve de
 * séance plutôt que date devinée »).
 */
export function dateSeanceDepuisHtml(html: string): MarketDate | null {
  const $ = cheerio.load(html);
  const sel = $(`select[name="${MARKET_DATE_FIELDS.dateSelect}"]`).first();
  if (sel.length === 0) return null;
  let v = sel.find('option[selected]').first().attr('value');
  // ASP.NET peut sérialiser la sélection en selected="selected" comme en
  // attribut nu ; cheerio couvre les deux. Sans attribut, le navigateur
  // prendrait la première option — ce n'est PAS une preuve, on renonce.
  if (!v) return null;
  v = v.trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

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
  const datePage = dateSeanceDepuisHtml(html);
  if (!datePage) {
    // Pas de date lisible : on n'écrit rien sous une date devinée. Le job
    // échoue bruyamment, ce qui vaut mieux qu'une séance fantôme.
    throw new Error(
      `Activites_marche : date de séance introuvable sur la page (déroulant ${MARKET_DATE_FIELDS.dateSelect}) — aucune écriture. Aujourd'hui = ${todayMarketDate()}.`,
    );
  }
  if (datePage !== todayMarketDate()) {
    logger.info({ datePage, aujourdhui: todayMarketDate() }, 'Séance affichée différente du jour : on prend la date de la page');
  }
  const snap = snapshotFromHtml(html, datePage);
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
