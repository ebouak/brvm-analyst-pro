/**
 * Flux d'authentification BDFIN (ASP.NET Forms Authentication).
 *
 * Séquence :
 *   1. GET de la page de login -> récupère __VIEWSTATE / __EVENTVALIDATION
 *      + dépose le cookie ASP.NET_SessionId dans le jar.
 *   2. POST des identifiants + champs cachés sur la même page.
 *   3. ASP.NET répond 302 vers la page d'accueil et pose le cookie d'auth Forms.
 *      Le cookie jar (http.ts) suit la redirection et conserve le cookie.
 *   4. On vérifie qu'on n'est PAS retombé sur la page de login.
 *
 * IMPORTANT : les noms exacts des champs de login (txtUser / Password /
 * bouton de soumission) dépendent du markup BDFIN. Ils sont paramétrables
 * ci-dessous et documentés dans docs/SCRAPER.md. Ajustez FIELD_* après
 * inspection réelle de la page (un dump est fourni en mode debug).
 */
import type { HttpClient } from './http.js';
import {
  extractAspNetState,
  looksLikeLoginPage,
  buildPostback,
} from './aspnet.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

/**
 * Noms des contrôles du formulaire de login.
 * Valeurs par défaut basées sur les conventions WebForms courantes ;
 * à confirmer/ajuster selon le markup réel (voir SCRAPER.md §"Calibrage").
 */
export const LOGIN_FIELDS = {
  username: 'ctl00$Main_Login1$UserName',
  password: 'ctl00$Main_Login1$Password',
  submit: 'ctl00$Main_Login1$LoginButton',
  submitValue: 'Se connecter',
} as const;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authentifie le client. Lève AuthError si la connexion échoue.
 * À l'issue, le cookie jar du client porte la session valide.
 */
export async function login(http: HttpClient): Promise<void> {
  const cfg = getConfig();
  if (!cfg.BDFIN_USERNAME || !cfg.BDFIN_PASSWORD) {
    throw new AuthError(
      'BDFIN_USERNAME / BDFIN_PASSWORD manquants. Renseignez-les en variables ' +
        "d'environnement (jamais en clair dans le code).",
    );
  }

  // 1) GET page de login -> état ASP.NET + cookie de session.
  logger.info('Connexion BDFIN : récupération de la page de login');
  const loginPage = await http.get(cfg.BDFIN_LOGIN_PATH);
  const state = extractAspNetState(loginPage.data);

  if (!state.hidden['__VIEWSTATE']) {
    logger.warn(
      'La page de login ne contient pas __VIEWSTATE — markup inattendu. ' +
        'Vérifiez BDFIN_LOGIN_PATH et le calibrage des champs.',
    );
  }

  // 2) POST des identifiants + tous les champs cachés.
  const form = buildPostback(state, LOGIN_FIELDS.submit, '', {
    [LOGIN_FIELDS.username]: cfg.BDFIN_USERNAME,
    [LOGIN_FIELDS.password]: cfg.BDFIN_PASSWORD,
    [LOGIN_FIELDS.submit]: LOGIN_FIELDS.submitValue,
  });

  logger.info('Connexion BDFIN : envoi des identifiants');
  const resp = await http.postForm(cfg.BDFIN_LOGIN_PATH, form);

  // 3/4) Vérification : on ne doit plus voir la page de login.
  if (looksLikeLoginPage(resp.data)) {
    throw new AuthError(
      'Échec de connexion BDFIN : la réponse ressemble encore à la page de ' +
        'login. Causes probables : identifiants invalides, calibrage des ' +
        'champs LOGIN_FIELDS incorrect, ou cookie de session non conservé.',
    );
  }

  logger.info('Connexion BDFIN réussie (session active)');
}

/**
 * Garantit une session valide : si une page ramène au login, on se reconnecte.
 * Renvoie le HTML de la page demandée, authentifié.
 */
export async function getAuthenticated(
  http: HttpClient,
  path: string,
): Promise<string> {
  let resp = await http.get(path);
  if (looksLikeLoginPage(resp.data)) {
    logger.warn('Session expirée détectée — reconnexion');
    await login(http);
    resp = await http.get(path);
    if (looksLikeLoginPage(resp.data)) {
      throw new AuthError(
        `Impossible d'accéder à ${path} même après reconnexion.`,
      );
    }
  }
  return resp.data;
}
