/**
 * Tests de aspx-session.ts via mock HttpClient (pas de nock ni d'accès réseau).
 *
 * La stratégie de mock : HttpClient est une interface pure { jar, get, postForm }.
 * On l'implémente directement en vitest plutôt que d'intercepter des sockets HTTP,
 * ce qui est plus robuste avec l'ESM et axios-cookiejar-support.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CookieJar } from 'tough-cookie';
import type { AxiosResponse } from 'axios';
import {
  loginBdfinSession,
  isSessionValid,
  refreshSession,
  ensureSession,
  AuthError,
} from '../src/scrapers/aspx-session.js';
import { extractAspNetState } from '../src/client/aspnet.js';
import { resetConfigCache } from '../src/config.js';

// ---------------------------------------------------------------------------
// Helpers HTML
// ---------------------------------------------------------------------------

const LOGIN_PAGE_HTML = `
<html><body>
  <input type="hidden" name="__VIEWSTATE" value="abc123" />
  <input type="hidden" name="__EVENTVALIDATION" value="ev456" />
  <input type="password" name="ctl00$ContentPlaceHolder1$txtPassword" />
  <span>Connexion</span>
</body></html>`;

const MARKET_PAGE_HTML = `
<html><body>
  <h1>Activites du marche</h1>
  <table id="ContentPlaceHolder1_GridViewActions">
    <tr><th>Code</th><th>Cours Jour</th></tr>
    <tr><td>SNTS</td><td>14 500</td></tr>
  </table>
</body></html>`;

function makeAxiosResp(html: string): AxiosResponse<string> {
  return { data: html, status: 200, statusText: 'OK', headers: {}, config: {} as never };
}

// ---------------------------------------------------------------------------
// Factory : HttpClient mocké
// ---------------------------------------------------------------------------

function makeMockClient(opts: {
  loginPageHtml?: string;
  marketPageHtml?: string;
  postReturnsMarket?: boolean;
}) {
  const { loginPageHtml = LOGIN_PAGE_HTML, marketPageHtml = MARKET_PAGE_HTML, postReturnsMarket = true } = opts;
  const jar = new CookieJar();
  const get = vi.fn(async (path: string) => {
    // La page de login retourne le HTML de login, la page marché retourne le marché.
    if (path.includes('Default') || path === '/Default.aspx') {
      return makeAxiosResp(loginPageHtml);
    }
    return makeAxiosResp(marketPageHtml);
  });
  const postForm = vi.fn(async (_path: string, _form: Record<string, string>) => {
    return makeAxiosResp(postReturnsMarket ? marketPageHtml : loginPageHtml);
  });
  return { jar, get, postForm };
}

// ---------------------------------------------------------------------------
// Test 1 : extraction VIEWSTATE depuis HTML réel (pur, sans réseau)
// ---------------------------------------------------------------------------

describe('extractAspNetState', () => {
  it('extrait __VIEWSTATE et __EVENTVALIDATION depuis la page de login', () => {
    const state = extractAspNetState(LOGIN_PAGE_HTML);
    expect(state.hidden['__VIEWSTATE']).toBe('abc123');
    expect(state.hidden['__EVENTVALIDATION']).toBe('ev456');
  });

  it('retourne un objet vide sur HTML sans champs cachés', () => {
    const state = extractAspNetState('<html><body><p>hello</p></body></html>');
    expect(Object.keys(state.hidden)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2 : isSessionValid
// ---------------------------------------------------------------------------

describe('isSessionValid', () => {
  it('retourne true si la page marché est accessible', async () => {
    const http = makeMockClient({});
    const result = await isSessionValid(http);
    expect(result).toBe(true);
  });

  it('retourne false si la page marché retourne la page de login (session expirée)', async () => {
    const http = makeMockClient({ marketPageHtml: LOGIN_PAGE_HTML });
    const result = await isSessionValid(http);
    expect(result).toBe(false);
  });

  it('retourne false en cas d\'erreur réseau (pas d\'exception)', async () => {
    const jar = new CookieJar();
    const http = {
      jar,
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      postForm: vi.fn(),
    };
    const result = await isSessionValid(http);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 3 : refreshSession déclenche login()
// ---------------------------------------------------------------------------

describe('refreshSession', () => {
  it('appelle get (récup VIEWSTATE) puis postForm (envoi credentials)', async () => {
    process.env['BDFIN_USERNAME'] = 'testuser';
    process.env['BDFIN_PASSWORD'] = 'testpass';
    resetConfigCache();

    const http = makeMockClient({ postReturnsMarket: true });

    await refreshSession(http);

    // login() = 1× GET (page login) + 1× POST (identifiants).
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.postForm).toHaveBeenCalledTimes(1);
  });

  it('lève AuthError si le POST retourne encore la page de login', async () => {
    process.env['BDFIN_USERNAME'] = 'testuser';
    process.env['BDFIN_PASSWORD'] = 'testpass';
    resetConfigCache();

    const http = makeMockClient({ postReturnsMarket: false });

    await expect(refreshSession(http)).rejects.toThrow(AuthError);
  });
});

// ---------------------------------------------------------------------------
// Test 4 : ensureSession rafraîchit si session expirée
// ---------------------------------------------------------------------------

describe('ensureSession', () => {
  beforeEach(() => {
    process.env['BDFIN_USERNAME'] = 'testuser';
    process.env['BDFIN_PASSWORD'] = 'testpass';
    resetConfigCache();
  });

  it('ne rafraîchit pas si la session est valide', async () => {
    const http = makeMockClient({});
    await ensureSession(http);
    // isSessionValid fait 1× GET. refreshSession ne doit pas être appelé.
    expect(http.postForm).not.toHaveBeenCalled();
  });

  it('rafraîchit si la session est expirée', async () => {
    // Premier GET (isSessionValid) → login page → session expirée.
    // Deuxième GET (login) → login page → VIEWSTATE.
    // POST (login) → market page → succès.
    const jar = new CookieJar();
    let callCount = 0;
    const http = {
      jar,
      get: vi.fn(async () => {
        callCount++;
        // 1er appel (isSessionValid) = page de login → session expirée.
        // 2e appel (login, récup VIEWSTATE) = page de login.
        return makeAxiosResp(LOGIN_PAGE_HTML);
      }),
      postForm: vi.fn(async () => makeAxiosResp(MARKET_PAGE_HTML)),
    };

    await ensureSession(http);

    // isSessionValid (1 GET) + login (1 GET + 1 POST).
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.postForm).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 5 : loginBdfinSession lève AuthError sans credentials
// ---------------------------------------------------------------------------

describe('loginBdfinSession', () => {
  it('lève AuthError si BDFIN_USERNAME est absent', async () => {
    const u = process.env['BDFIN_USERNAME'];
    const p = process.env['BDFIN_PASSWORD'];
    delete process.env['BDFIN_USERNAME'];
    delete process.env['BDFIN_PASSWORD'];
    resetConfigCache();
    try {
      await expect(loginBdfinSession()).rejects.toThrow(AuthError);
    } finally {
      if (u) process.env['BDFIN_USERNAME'] = u;
      if (p) process.env['BDFIN_PASSWORD'] = p;
      resetConfigCache();
    }
  });
});
