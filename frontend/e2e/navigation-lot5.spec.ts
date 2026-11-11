import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Refonte de navigation, lot 5 : plus de culs-de-sac, la fiche valeur est la
 * plaque tournante de ses documents, la 404 mène quelque part (en restant 404).
 *
 * Les pages sans session tournent partout ; celles qui exigent un compte
 * lisent les cookies de sessions locales (npm run e2e:connecte) et sont
 * IGNORÉES sinon.
 */
const COOKIES_ACTIF = process.env.PW_COOKIES_ACTIF;
const lisible = (f?: string) => Boolean(f && fs.existsSync(f));

test.describe('« Et maintenant ? » (pages publiques)', () => {
  for (const chemin of ['/simulateur', '/methodologie']) {
    test(`${chemin} propose des suites`, async ({ page }) => {
      await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      const section = page.getByRole('region', { name: /Et maintenant/ });
      await expect(section).toBeVisible();
      expect(await section.getByRole('link').count()).toBeGreaterThanOrEqual(1);
      expect(await section.getByRole('link').count()).toBeLessThanOrEqual(3);
    });
  }
});

test.describe('Pages connectées', () => {
  test.skip(!lisible(COOKIES_ACTIF), 'PW_COOKIES_ACTIF absent : session locale non fournie.');

  for (const chemin of ['/journal', '/backtest', '/premium/anomalies']) {
    test(`${chemin} propose des suites`, async ({ page, context }) => {
      await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
      await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
      await expect(page.getByRole('region', { name: /Et maintenant/ })).toBeVisible();
    });
  }

  test('le dossier valeur ramène à la fiche', async ({ page, context }) => {
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
    await page.goto('/rapports/dossier/SNTS', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
    const retour = page.getByRole('link', { name: /Retour à la fiche SNTS/ });
    await expect(retour).toHaveAttribute('href', '/actions/SNTS');
  });

  test('le dossier masque sa navigation à l\'impression', async ({ page, context }) => {
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
    await page.goto('/rapports/dossier/SNTS', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('nav[aria-label="Documents de la fiche"]')).toBeHidden();
  });
});

test.describe('Page 404', () => {
  test('reste une 404 réelle et propose de parcourir les sociétés', async ({ page }) => {
    const resp = await page.goto('/societes/ZZZZ', { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), 'statut HTTP').toBe(404);
    const lien = page.getByRole('link', { name: /Parcourir et rechercher/ });
    await expect(lien).toHaveAttribute('href', '/societes');
    await expect(page.getByRole('link', { name: /Se former/ })).toBeVisible();
  });
});
