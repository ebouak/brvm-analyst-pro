import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Refonte de navigation, lots 3 et 4 : registre, fil d'Ariane, élément actif
 * par parent, menu à six rubriques.
 *
 * Les pages publiques tournent partout. Celles qui exigent un compte lisent
 * les cookies de sessions locales (npm run e2e:connecte) et sont IGNORÉES sinon.
 */
const COOKIES_ACTIF = process.env.PW_COOKIES_ACTIF;
const lisible = (f?: string) => Boolean(f && fs.existsSync(f));
const fil = (page: Page) => page.getByRole('navigation', { name: "Fil d'Ariane" }).first();

async function jsonLdFil(page: Page) {
  const blocs = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocs.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
}

test.describe('Pages publiques : fil d\'Ariane et BreadcrumbList', () => {
  const cas: { chemin: string; parent: string; maillons: string[] }[] = [
    { chemin: '/comparateur-sgi/annuaire', parent: '/comparateur-sgi', maillons: ['Accueil', 'Choisir sa SGI', 'Annuaire des SGI'] },
    { chemin: '/analyses/hebdo', parent: '/analyses', maillons: ['Accueil', 'Analyses', 'Valeurs de la semaine'] },
    { chemin: '/societes/SNTS', parent: '/societes', maillons: ['Accueil', 'Sociétés cotées'] },
  ];
  for (const c of cas) {
    test(`${c.chemin} : JSON-LD servi, puis retour par le fil`, async ({ page }) => {
      await page.goto(c.chemin, { waitUntil: 'domcontentloaded' });
      const ld = await jsonLdFil(page);
      expect(ld, 'BreadcrumbList absent').toBeTruthy();
      const noms = ld.itemListElement.map((i: { name: string }) => i.name);
      expect(noms.slice(0, c.maillons.length)).toEqual(c.maillons);
      expect(ld.itemListElement.every((i: { item: string }) => /^https?:\/\//.test(i.item))).toBe(true);
      // Aucun maillon public ne pointe vers une page à compte.
      expect(ld.itemListElement.some((i: { item: string }) => /\/dividendes$|\/dashboard/.test(i.item))).toBe(false);
      await fil(page).locator(`a[href="${c.parent}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${c.parent}$`));
    });
  }

  test('/fiscalite : aucun lien vers une page à compte pour un visiteur', async ({ page }) => {
    await page.goto('/fiscalite', { waitUntil: 'domcontentloaded' });
    await expect(fil(page).locator('a[href="/dividendes"]')).toHaveCount(0);
    await expect(fil(page).getByRole('link', { name: 'Mon tableau de bord' })).toHaveCount(0);
  });
});

test.describe('Shell applicatif (compte actif)', () => {
  test.skip(!lisible(COOKIES_ACTIF), 'PW_COOKIES_ACTIF absent : session locale non fournie.');

  const cas: { chemin: string; actif: string; retour: string }[] = [
    { chemin: '/veille', actif: 'Actualités', retour: '/actualites' },
    { chemin: '/notations', actif: 'Fondamentaux', retour: '/fondamentaux' },
    { chemin: '/premium/dcf', actif: 'Valorisation', retour: '/premium/valorisation' },
    { chemin: '/premium/calendrier', actif: 'Agenda', retour: '/calendrier' },
    { chemin: '/dashboard/reports', actif: 'Rapports', retour: '/reports' },
    { chemin: '/actions/SNTS/financials', actif: 'Actions', retour: '/actions/SNTS' },
    { chemin: '/conseiller/track-record', actif: 'Conseiller', retour: '/conseiller' },
  ];

  for (const c of cas) {
    test(`${c.chemin} : « ${c.actif} » actif, retour par le fil`, async ({ page, context }) => {
      await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
      await page.goto(c.chemin, { waitUntil: 'domcontentloaded' });
      test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
      const sidebar = page.locator('aside');
      await expect(sidebar.locator('a[aria-current="page"]')).toHaveText(new RegExp(`^${c.actif}`));
      await fil(page).locator(`a[href="${c.retour}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${c.retour}$`));
    });
  }

  test('le menu a six rubriques et un bouton Rechercher', async ({ page, context }) => {
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
    const sidebar = page.locator('aside');
    for (const r of ["Aujourd'hui", 'Le marché', 'Trouver une idée', 'Mes revenus', 'Mon portefeuille', 'Apprendre']) {
      await expect(sidebar.getByRole('button', { name: r })).toBeVisible();
    }
    await sidebar.getByRole('button', { name: /Rechercher/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('page publique : « Mon tableau de bord » pour une session ouverte', async ({ page, context }) => {
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
    await page.goto('/fiscalite', { waitUntil: 'domcontentloaded' });
    await fil(page).getByRole('link', { name: 'Mon tableau de bord' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('/veille allume « Aujourd\'hui » dans la barre du bas', async ({ page, context }) => {
      await context.addCookies(JSON.parse(fs.readFileSync(COOKIES_ACTIF!, 'utf8')));
      await page.goto('/veille', { waitUntil: 'domcontentloaded' });
      test.skip(page.url().includes('/login'), 'Session expirée : redirigé vers /login.');
      const barre = page.getByRole('navigation', { name: 'Navigation principale mobile' });
      await expect(barre.locator('a[aria-current="page"]')).toHaveText("Aujourd'hui");
    });
  });
});
