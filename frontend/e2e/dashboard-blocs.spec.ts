import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Blocs adaptatifs du tableau de bord (spec §8) : rendu sans valeur cassée et
 * sans débordement horizontal sur mobile. Exige une session locale sérialisée
 * en cookie Playwright (hors dépôt) ; sans elle → skip propre.
 */
const COOKIE_FILE = process.env.PW_COOKIES ?? String.raw`C:\Users\adego\AppData\Local\Temp\pw-cookies.json`;

for (const vue of [{ nom: 'ordinateur', width: 1366, height: 900 }, { nom: 'mobile', width: 390, height: 844 }]) {
  test(`dashboard (${vue.nom}) : blocs rendus, aucune valeur cassée`, async ({ page, context }) => {
    test.skip(!fs.existsSync(COOKIE_FILE), 'Session locale absente (cookie Playwright non fourni).');
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')));
    await page.setViewportSize({ width: vue.width, height: vue.height });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée → redirigé vers /login.');
    await page.waitForTimeout(3000);

    const texte = await page.locator('body').innerText();
    expect(texte).not.toMatch(/\bNaN\b|\bundefined\b|\bInfinity\b/);
    await expect(page.getByRole('heading', { name: 'Mon portefeuille' })).toBeVisible();

    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(deborde, 'débordement horizontal de la page').toBe(false);
  });
}
