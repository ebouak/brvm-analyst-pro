import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Screener multi-critères (/screener) — premier module suivi dans
 * /admin/qualite.
 *
 * Deux publics, deux garanties :
 *   - visiteur : le screener reste derrière le mur de connexion, et la
 *     destination est conservée pour y revenir après connexion ;
 *   - compte Premium : la page se charge (tableau ou état vide déclaré) et le
 *     filtre de liquidité réagit.
 *
 * Les scénarios Premium exigent une session de test sérialisée par Playwright
 * (fichier `storageState`, chemin dans PW_PREMIUM_STATE). Sans elle, ils sont
 * IGNORÉS — et le tableau de bord le dit : un scénario ignoré ne valide rien.
 */

const ETAT_PREMIUM = process.env.PW_PREMIUM_STATE;
const sessionPremium = Boolean(ETAT_PREMIUM && fs.existsSync(ETAT_PREMIUM));

test.describe('visiteur non connecté', () => {
  test('le screener renvoie vers la connexion en gardant la destination', async ({ page }) => {
    await page.goto('/screener', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?next=%2Fscreener$/);
  });

  test('le screener intraday aussi', async ({ page }) => {
    await page.goto('/screener/intraday', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?next=%2Fscreener%2Fintraday$/);
  });
});

test.describe('compte Premium', () => {
  test.skip(!sessionPremium, 'Session Premium de test absente : scénarios ignorés, rien n’est validé.');
  test.use({ storageState: sessionPremium ? ETAT_PREMIUM : undefined });

  test('le screener se charge sans verrou Premium', async ({ page }) => {
    await page.goto('/screener', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session de test expirée : redirigé vers /login.');
    await expect(page.getByRole('heading', { level: 1, name: 'Screener multi-critères' })).toBeVisible();
    await expect(page.getByText(/Screener réservé au plan/)).toHaveCount(0);
    // Soit le tableau et ses filtres, soit l'état vide déclaré : jamais une page blanche.
    const filtre = page.getByRole('button', { name: 'A + B seulement' });
    const vide = page.getByText('Aucune séance disponible');
    await expect(filtre.or(vide)).toBeVisible();
  });

  test('le filtre de liquidité s’active et se désactive', async ({ page }) => {
    await page.goto('/screener', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session de test expirée : redirigé vers /login.');
    const ab = page.getByRole('button', { name: 'A + B seulement' });
    const toutes = page.getByRole('button', { name: 'Toutes' });
    await expect(ab).toBeVisible();
    await ab.click();
    await expect(ab).toHaveAttribute('aria-pressed', 'true');
    await expect(toutes).toHaveAttribute('aria-pressed', 'false');
    await toutes.click();
    await expect(toutes).toHaveAttribute('aria-pressed', 'true');
  });
});
