import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Blocs adaptatifs du tableau de bord (spec §8) : rendu sans valeur cassée et
 * sans débordement horizontal, pour DEUX profils. Chaque profil exige une
 * session locale sérialisée en cookie Playwright (hors dépôt) dont le chemin
 * vient d'une variable d'environnement ; sans elle → skip propre.
 *   PW_COOKIES_ACTIF     compte AVEC positions
 *   PW_COOKIES_DEBUTANT  compte SANS position
 */
const PROFILS = [
  { nom: 'actif', env: 'PW_COOKIES_ACTIF' },
  { nom: 'débutant', env: 'PW_COOKIES_DEBUTANT' },
] as const;
const VUES = [
  { nom: 'ordinateur', width: 1366, height: 900 },
  { nom: 'mobile', width: 390, height: 844 },
];

for (const profil of PROFILS) {
  for (const vue of VUES) {
    test(`dashboard ${profil.nom} (${vue.nom}) : blocs rendus, aucune valeur cassée`, async ({ page, context }) => {
      const fichier = process.env[profil.env];
      test.skip(!fichier || !fs.existsSync(fichier), `${profil.env} absent ou illisible (session locale non fournie).`);
      await context.addCookies(JSON.parse(fs.readFileSync(fichier!, 'utf8')));
      await page.setViewportSize({ width: vue.width, height: vue.height });
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      test.skip(page.url().includes('/login'), 'Session expirée → redirigé vers /login.');
      await page.locator('#bloc-portefeuille').waitFor();

      const texte = await page.locator('body').innerText();
      expect(texte).not.toMatch(/\bNaN\b|\bundefined\b|\bInfinity\b/);
      await expect(page.getByRole('heading', { name: 'Mon portefeuille' })).toBeVisible();

      const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(deborde, 'débordement horizontal de la page').toBe(false);

      if (profil.nom === 'actif') {
        // Un actif voit son portefeuille AVANT les indices pan-africains.
        const bloc = await page.locator('#bloc-portefeuille').boundingBox();
        const indices = await page.locator('section[aria-label="Indices pan-africains"]').boundingBox();
        expect(bloc, 'bloc portefeuille introuvable').not.toBeNull();
        expect(indices, 'section indices introuvable').not.toBeNull();
        expect(bloc!.y).toBeLessThan(indices!.y);
      } else {
        // Un débutant voit l'invitation à suivre une première position.
        await expect(page.getByText('Vous ne suivez encore aucune position.')).toBeVisible();
      }
    });
  }
}
