import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Saisonnalité v2 (lots 1-4) : les sections réservées à Premium se rendent avec
 * les données de saisonnalite_mensuelle / _fenetres / _etat / _bilans.
 * Exige une session Premium de test (PW_PREMIUM_STATE, comme screener.spec.ts) ;
 * sans elle le test est IGNORÉ et /admin/qualite l'affiche comme tel.
 */
const ETAT = process.env.PW_PREMIUM_STATE;
const session = Boolean(ETAT && fs.existsSync(ETAT));

test.describe('Saisonnalité', () => {
  test.skip(!session, 'Session de test absente : /saisonnalite est réservée aux comptes connectés.');
  test.use({ storageState: session ? ETAT : undefined });

  test('fiche SNTS : marché, mois en cours, grille, habitudes, événements, liquidité', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.goto('/saisonnalite?code=SNTS', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session de test expirée : redirigé vers /login.');

    await expect(page.getByRole('heading', { name: 'Saison du marché' })).toBeVisible();
    await expect(page.getByText(/Depuis le début de [a-zé]+ \(\d+(re|e) séance\)/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'La saison a-t-elle tenu ?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Calendrier des habitudes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Autour des événements' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saison de la liquidité' })).toBeVisible();
    // Bascule dividende réinvesti / cours seul.
    await page.getByRole('button', { name: 'cours seul' }).first().click();
    await expect(page.getByText(/cours seul\. Dernière ligne/)).toBeVisible();
    expect(erreurs, erreurs.join('\n')).toEqual([]);
  });

  test('ce mois-ci : état daté de la séance, tableau et bilan public', async ({ page }) => {
    await page.goto('/saisonnalite/ce-mois-ci', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session de test expirée : redirigé vers /login.');
    await expect(page.getByText(/^Séance du \d{1,2} [a-zéû]+ \d{4}/)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Fourchette habituelle' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'La saison a-t-elle tenu, mois après mois ?' })).toBeVisible();
    // Filtre « hors de la fourchette » : seuls les états au-dessus / en dessous restent.
    await page.getByRole('link', { name: 'hors de la fourchette' }).click();
    await expect(page).toHaveURL(/etat=hors/);
    const etats = await page.locator('tbody tr td:nth-child(4)').allInnerTexts();
    for (const e of etats) expect(e).toMatch(/au-dessus|en dessous|—/);
  });
});
