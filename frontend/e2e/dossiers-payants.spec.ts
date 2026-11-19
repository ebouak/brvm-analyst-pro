import { expect, test } from '@playwright/test';

test.describe('dossiers valeur à l’unité', () => {
  test('le catalogue et l’article exposent le modèle éditorial public', async ({ page }) => {
    await page.goto('/analyses/dossiers');
    await expect(page.getByRole('heading', { level: 1, name: /Lire une entreprise/i })).toBeVisible();
    await expect(page.locator('.dossier-card').first()).toBeVisible();

    await page.goto('/analyses/dossiers/SNTS');
    await expect(page.locator('.dossier-feuille')).toHaveCount(2);
    await expect(page.getByText('La lecture ouverte s’arrête ici.')).toBeVisible();
    await expect(page.getByText(/1 500/)).toBeVisible();
  });

  test('le PDF privé reste refusé sans session', async ({ request }) => {
    const response = await request.get('/api/dossier/SNTS/pdf');
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Connexion requise.' });
  });
});
