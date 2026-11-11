import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Refonte de navigation, lot 1 : la page demandée n'est plus perdue (connexion,
 * porte Premium), et le mobile ne déborde plus.
 *
 * Les parcours sans session tournent partout. Ceux qui exigent un compte lisent
 * les cookies de sessions locales (npm run e2e:connecte) et sont IGNORÉS sinon.
 */
const COOKIES_ACTIF = process.env.PW_COOKIES_ACTIF;
const COOKIES_DEBUTANT = process.env.PW_COOKIES_DEBUTANT;
const lisible = (f?: string) => Boolean(f && fs.existsSync(f));

test.describe('Connexion : la page demandée est gardée en entier', () => {
  test('un visiteur sur une page filtrée arrive sur /login avec next = chemin + query', async ({ page }) => {
    await page.goto('/dividendes/calendrier?annee=2025&code=SNTS', { waitUntil: 'domcontentloaded' });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/dividendes/calendrier?annee=2025&code=SNTS');
    // La query n'est plus recopiée sur /login.
    expect(url.searchParams.get('annee')).toBeNull();
    expect(url.searchParams.get('code')).toBeNull();
    await expect(page.getByText('Connectez-vous pour accéder à cette page.')).toBeVisible();
  });

  test('un lien externe en // n\'est pas pris pour une page demandée', async ({ page }) => {
    await page.goto('/login?next=//evil.com', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Connectez-vous pour accéder à cette page.')).toHaveCount(0);
  });
});

test.describe('Mobile 390 px : aucun débordement horizontal (visiteur)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const chemin of ['/login', '/signup', '/comparateur-sgi']) {
    test(`${chemin}`, async ({ page }) => {
      await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const largeur = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(largeur.sw, `scrollWidth ${largeur.sw} > innerWidth ${largeur.iw}`).toBeLessThanOrEqual(largeur.iw + 1);
    });
  }
});

test.describe('Mobile 390 px : aucun débordement horizontal (compte actif)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.skip(!lisible(COOKIES_ACTIF), 'PW_COOKIES_ACTIF absent : session locale non fournie.');
  for (const chemin of ['/conseiller', '/screener', '/obligations']) {
    test(`${chemin}`, async ({ page, context }) => {
      await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
      await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
      await page.waitForTimeout(1500);
      const largeur = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(largeur.sw, `scrollWidth ${largeur.sw} > innerWidth ${largeur.iw}`).toBeLessThanOrEqual(largeur.iw + 1);
    });
  }
});

test.describe('Porte Premium (compte gratuit)', () => {
  test.skip(!lisible(COOKIES_DEBUTANT), 'PW_COOKIES_DEBUTANT absent : session locale non fournie.');

  test('/premium/dcf mène à /premium/upgrade?from=… avec un lien vers les formules, sans mailto', async ({ page, context }) => {
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_DEBUTANT!, 'utf8')));
    await page.goto('/premium/dcf', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
    expect(new URL(page.url()).pathname).toBe('/premium/upgrade');
    expect(new URL(page.url()).search).toBe('?from=%2Fpremium%2Fdcf');
    await expect(page.getByText(/Valorisation DCF/).first()).toBeVisible();
    const formules = page.getByRole('link', { name: 'Voir les formules' });
    await expect(formules).toHaveAttribute('href', '/account/plan?from=%2Fpremium%2Fdcf');
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.getByText('support@westbourse.com')).toBeVisible();
    // Le retour est assaini : une adresse externe n'est jamais reprise.
    await page.goto('/premium/upgrade?from=//evil.com', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Voir les formules' })).toHaveAttribute('href', '/account/plan');
  });

  test('un lien verrouillé du menu emporte la page demandée', async ({ page, context }) => {
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_DEBUTANT!, 'utf8')));
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
    await expect(page.locator('a[href^="/premium/upgrade?from="]').first()).toBeVisible();
  });
});

test.describe('Précédent sur un module vidéo', () => {
  test('Précédent ramène à la page d\'avant', async ({ page }) => {
    await page.goto('/formations/modules', { waitUntil: 'domcontentloaded' });
    const lien = page.locator('a[href^="/formations/modules/"]').first();
    test.skip((await lien.count()) === 0, 'Aucun module publié.');
    const href = await lien.getAttribute('href');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.goto('/formations/modules', { waitUntil: 'domcontentloaded' });
    await page.goto(href!, { waitUntil: 'load' });
    await page.waitForTimeout(3000); // laisse le lecteur tiers charger
    await page.goBack({ waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname).toBe('/formations/modules');
  });
});
