/**
 * Gestion de la session ASPX pour bfin.brvm.org.
 *
 * Couche au-dessus de client/auth.ts qui expose :
 *   - loginBdfinSession() : crée un HttpClient et ouvre une session
 *   - isSessionValid()    : teste si la session courante est active
 *   - refreshSession()    : reconnecte sans recréer le client
 *
 * Ces fonctions acceptent un HttpClient en paramètre pour faciliter
 * les tests (injection du client mocké, pas besoin de nock).
 */
import { createHttpClient, type HttpClient } from '../client/http.js';
import { login, AuthError } from '../client/auth.js';
import { looksLikeLoginPage } from '../client/aspnet.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

export { AuthError };

export interface BdfinSession {
  http: HttpClient;
  /** Résumé des cookies déposés (valeurs masquées pour les logs). */
  cookieSummary: string;
}

/**
 * Crée un nouveau HttpClient, authentifie la session et retourne les deux.
 * Lève AuthError si les credentials sont absents ou incorrects.
 */
export async function loginBdfinSession(): Promise<BdfinSession> {
  const cfg = getConfig();
  if (!cfg.BDFIN_USERNAME || !cfg.BDFIN_PASSWORD) {
    throw new AuthError(
      'BDFIN_USERNAME / BDFIN_PASSWORD manquants — renseignez .env.local.',
    );
  }
  const http = createHttpClient();
  await login(http);

  const cookies = await http.jar.getCookies(cfg.BDFIN_BASE_URL);
  const cookieSummary = cookies.map((c) => `${c.key}=<redacted>`).join('; ');
  logger.info({ cookieSummary }, 'loginBdfinSession : session établie');

  return { http, cookieSummary };
}

/**
 * Teste si la session courante est valide en récupérant la page marché.
 * Retourne false si la réponse ressemble à la page de login.
 * Ne lève pas d'exception sur erreur réseau — retourne false.
 */
export async function isSessionValid(http: HttpClient): Promise<boolean> {
  const cfg = getConfig();
  try {
    const resp = await http.get(cfg.BDFIN_MARKET_PATH);
    return !looksLikeLoginPage(resp.data);
  } catch {
    return false;
  }
}

/**
 * Reconnecte la session sur un client existant (conserve le cookie jar).
 * À appeler quand isSessionValid() retourne false.
 * Lève AuthError si la reconnexion échoue.
 */
export async function refreshSession(http: HttpClient): Promise<void> {
  logger.info('refreshSession : reconnexion BDFIN');
  await login(http);
  logger.info('refreshSession : session renouvelée');
}

/**
 * Garantit une session valide : si la session a expiré, la rafraîchit.
 * Utile avant un fetch long où la session peut expirer en cours de route.
 */
export async function ensureSession(http: HttpClient): Promise<void> {
  const valid = await isSessionValid(http);
  if (!valid) {
    await refreshSession(http);
  }
}
