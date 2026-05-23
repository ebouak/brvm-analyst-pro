/**
 * Interface calibrée pour bfin.brvm.org — exposition directe des primitives
 * d'authentification et de fetch, séparée du runner de production pour
 * faciliter le calibrage des sélecteurs (cf. docs/SCRAPER.md §4).
 *
 * Usage de calibrage :
 *   tsx src/scrapers/bfin-real.ts   (ou importer loginBdfin / fetchCoursduJour)
 *
 * Sélecteurs à ajuster si BDFIN modifie son markup :
 *   - LOGIN_FIELDS dans client/auth.ts
 *   - ACTIONS_TABLE_SELECTORS dans parsers/actions.ts
 *   - MARKET_DATE_FIELDS dans scrapers/activitesMarche.ts
 */
import { createHttpClient, type HttpClient } from '../client/http.js';
import { login } from '../client/auth.js';
import { getAuthenticated } from '../client/auth.js';
import { parseActions } from '../parsers/actions.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import type { ActionRow } from '../types.js';

/**
 * Sous-ensemble de ActionRow centré sur les cotations du jour.
 * On exclut pays/secteur (présents en base via brvm_instruments) pour
 * garder fetchCoursduJour() concentré sur les données prix/volume.
 */
export interface ActionQuote {
  code: string;
  designation: string;
  cours_precedent: number | null;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
}

/**
 * Résultat de loginBdfin() : le client HTTP avec session active et
 * une représentation lisible des cookies pour debug/logs.
 */
export interface BdfinSession {
  http: HttpClient;
  /** Cookies de session sérialisés (ASP.NET_SessionId + .ASPXAUTH). */
  cookieSummary: string;
}

/**
 * Crée un client HTTP, authentifie la session sur bfin.brvm.org et
 * renvoie le client prêt à l'emploi.
 *
 * Lève AuthError si les identifiants sont absents ou incorrects.
 */
export async function loginBdfin(): Promise<BdfinSession> {
  const cfg = getConfig();
  if (!cfg.BDFIN_USERNAME || !cfg.BDFIN_PASSWORD) {
    throw new Error(
      'BDFIN_USERNAME / BDFIN_PASSWORD manquants — renseignez .env.local.',
    );
  }

  const http = createHttpClient();
  await login(http);

  // Sérialise les cookies pour debug (secrets masqués dans logger, pas ici).
  const cookies = await http.jar.getCookies(cfg.BDFIN_BASE_URL);
  const cookieSummary = cookies.map((c) => `${c.key}=<redacted>`).join('; ');

  logger.info({ cookieSummary }, 'loginBdfin : session établie');
  return { http, cookieSummary };
}

/**
 * Récupère les cotations actions de la séance courante depuis
 * la page Activites_marche.aspx (ou BDFIN_MARKET_PATH).
 *
 * Si `http` n'est pas fourni, une nouvelle session est ouverte.
 * Renvoie [] si le tableau est vide ou si les sélecteurs ne matchent pas.
 */
export async function fetchCoursduJour(http?: HttpClient): Promise<ActionQuote[]> {
  const cfg = getConfig();
  const client = http ?? (await loginBdfin()).http;

  const html = await getAuthenticated(client, cfg.BDFIN_MARKET_PATH);

  // Dump HTML en debug pour faciliter l'inspection des sélecteurs réels.
  if (cfg.LOG_LEVEL === 'debug') {
    const preview = html.slice(0, 2000).replace(/\s+/g, ' ');
    logger.debug({ htmlPreview: preview }, 'fetchCoursduJour : HTML reçu');
  }

  const rows: ActionRow[] = parseActions(html);
  logger.info({ count: rows.length }, 'fetchCoursduJour : cotations parsées');

  return rows.map(toQuote);
}

function toQuote(r: ActionRow): ActionQuote {
  return {
    code: r.code,
    designation: r.designation,
    cours_precedent: r.cours_precedent,
    cours_jour: r.cours_jour,
    variation_pct: r.variation_pct,
    volume: r.volume,
  };
}
