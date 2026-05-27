/**
 * Client HTTP avec cookie jar persistant (tough-cookie).
 *
 * BDFIN tourne sur ASP.NET WebForms : la session est portée par un cookie
 * (ASP.NET_SessionId + cookie d'auth Forms). Il est IMPÉRATIF de conserver
 * le jar entre la requête de login et toutes les requêtes suivantes,
 * sinon le serveur renvoie la page de connexion (cf. §11).
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { getConfig } from '../config.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '../logger.js';

// La validation TLS est désactivée globalement par polyfills.ts via
// https.globalAgent.options.rejectUnauthorized = false. axios-cookiejar-support
// ne supporte pas qu'on passe un httpsAgent custom — il gère son propre agent.

export interface HttpClient {
  jar: CookieJar;
  /** GET HTML, suit les redirects, conserve les cookies. */
  get(path: string): Promise<AxiosResponse<string>>;
  /** POST application/x-www-form-urlencoded (postback ASP.NET). */
  postForm(
    path: string,
    form: Record<string, string>,
  ): Promise<AxiosResponse<string>>;
}

export function createHttpClient(): HttpClient {
  const cfg = getConfig();
  const jar = new CookieJar();

  const instance: AxiosInstance = wrapper(
    axios.create({
      baseURL: cfg.BDFIN_BASE_URL,
      timeout: cfg.HTTP_TIMEOUT_MS,
      jar,
      withCredentials: true,
      // On gère nous-mêmes les status pour pouvoir inspecter les 302 d'ASP.NET.
      maxRedirects: 5,
      // Décompresse gzip/deflate automatiquement.
      decompress: true,
      headers: {
        'User-Agent': cfg.HTTP_USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    }),
  );

  const retryOpts = {
    maxRetries: cfg.HTTP_MAX_RETRIES,
    baseMs: cfg.HTTP_RETRY_BASE_MS,
  };

  async function get(path: string): Promise<AxiosResponse<string>> {
    return withRetry(
      async () => {
        logger.debug({ path }, 'HTTP GET');
        return instance.get<string>(path, { responseType: 'text' });
      },
      { ...retryOpts, label: `GET ${path}` },
    );
  }

  async function postForm(
    path: string,
    form: Record<string, string>,
  ): Promise<AxiosResponse<string>> {
    const body = new URLSearchParams(form).toString();
    return withRetry(
      async () => {
        logger.debug({ path, fields: Object.keys(form) }, 'HTTP POST form');
        return instance.post<string>(path, body, {
          responseType: 'text',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // ASP.NET attend souvent un Referer cohérent pour valider le postback.
            Referer: cfg.BDFIN_BASE_URL + path,
            Origin: cfg.BDFIN_BASE_URL,
          },
        });
      },
      { ...retryOpts, label: `POST ${path}` },
    );
  }

  return { jar, get, postForm };
}
