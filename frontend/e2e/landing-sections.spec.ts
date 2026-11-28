import { test, expect } from '@playwright/test';

/** Landing : thermomètre du marché et section « Apprendre » (spec 2026-11-28). */
test.describe('landing : thermomètre et formation', () => {
  test('le thermomètre suit l’indice et mène au Stress Monitor', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const t = page.locator('#thermometre');
    test.skip((await t.count()) === 0, 'Aucune donnée de tension en base.');
    await expect(t.getByRole('heading', { level: 2 })).toHaveText(/^Le marché est-il nerveux \?/);
    await expect(t.getByRole('meter')).toBeAttached();
    await expect(t.getByRole('link', { name: 'Comprendre la tension du marché' })).toHaveAttribute('href', '/stress-monitor');
  });

  test('la section Apprendre propose la Leçon 1 et le programme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const a = page.locator('#apprendre');
    await expect(a.getByRole('heading', { level: 2 })).toContainText('Apprendre à investir à la BRVM.');
    await expect(a.getByRole('link', { name: 'Commencer la Leçon 1' })).toHaveAttribute(
      'href',
      '/formations/academy/academy-niveau-1-initiation?lecon=1',
    );
    await expect(a.getByRole('link', { name: 'Voir le programme' })).toHaveAttribute('href', '/formations/academy');
    await expect(a.locator('video')).toHaveAttribute('preload', 'none');
  });
});
