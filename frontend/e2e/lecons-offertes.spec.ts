import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Leçons offertes de l'Academy (lib/academy/leconsOffertes.ts).
 *  - Niveau 1, Leçon 1 : ouverte à tous.
 *  - Niveau 2, cas Sonatel (« Lire un rapport annuel ») : ouverte avec un compte
 *    gratuit ; sans session, aperçu + invitation, et le corps ne quitte PAS le
 *    serveur (vérifié sur la réponse brute, charge RSC comprise).
 * Le cas connecté exige la session locale PW_COOKIES_DEBUTANT (compte gratuit,
 * `npm run e2e:connecte`) ; sans elle → skip propre.
 *
 * Sauté en CI : les pages Academy lisent la base avec la clé serveur, que la CI
 * n'a pas par choix (CLAUDE.md, « Qualité & Tests »). À lancer en local.
 */
test.skip(!!process.env.CI, 'La CI n’a pas la clé serveur : les pages Academy ne s’y rendent pas.');
const N1 = '/formations/academy/academy-niveau-1-initiation';
const N2 = '/formations/academy/academy-niveau-2-fondamental';
// Extrait du corps de la leçon Sonatel, absent des titres et résumés (ASCII : lisible tel quel dans la charge RSC).
const CORPS_SONATEL = 'tiennent leurs comptes selon le SYSCOHADA';

test.describe('leçons offertes, sans session', () => {
  test('la Leçon 1 du Niveau 1 s’ouvre à tous', async ({ page }) => {
    await page.goto(`${N1}?lecon=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Leçon offerte', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Débloquer la suite du niveau →' })).toBeVisible();
  });

  test('le cas Sonatel invite à créer un compte, sans livrer le corps', async ({ page, request }) => {
    await page.goto(`${N2}?lecon=9`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Cette leçon est offerte')).toBeVisible();
    const inscription = page.getByRole('link', { name: 'Créer mon compte gratuit' });
    await expect(inscription).toHaveAttribute('href', `/signup?next=${encodeURIComponent(`${N2}?lecon=9`)}`);

    const brut = await (await request.get(`${N2}?lecon=9`)).text();
    expect(brut, 'le corps de la leçon offerte avec compte a fuité sans session').not.toContain(CORPS_SONATEL);
  });

  test('une leçon payante du Niveau 2 reste fermée, la leçon offerte y est signalée', async ({ page }) => {
    await page.goto(`${N2}?lecon=10`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Programme complet du parcours')).toBeVisible();
    await expect(page.getByText('Cette leçon est offerte')).toHaveCount(0);
    await expect(page.getByText('Offerte', { exact: true }).first()).toBeAttached();
  });
});

test.describe('leçons offertes, compte gratuit', () => {
  test('le cas Sonatel s’ouvre, la leçon suivante reste fermée', async ({ page, context }) => {
    const fichier = process.env.PW_COOKIES_DEBUTANT;
    test.skip(!fichier || !fs.existsSync(fichier), 'PW_COOKIES_DEBUTANT absent (session locale non fournie).');
    await context.addCookies(JSON.parse(fs.readFileSync(fichier!, 'utf8')));

    await page.goto(`${N2}?lecon=9`, { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée → redirigé vers /login.');
    await expect(page.getByText('Leçon offerte avec votre compte gratuit')).toBeVisible();
    await expect(page.getByText(CORPS_SONATEL, { exact: false })).toBeVisible();

    await page.goto(`${N2}?lecon=10`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Programme complet du parcours')).toBeVisible();
    await expect(page.getByText(CORPS_SONATEL, { exact: false })).toHaveCount(0);
  });
});
