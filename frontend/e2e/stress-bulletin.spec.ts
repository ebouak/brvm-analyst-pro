import { test, expect } from '@playwright/test';

/** Bulletin du marché : page publique (clé anonyme), exécutable en CI. */
test.describe('Stress Monitor : bulletin du marché', () => {
  test('le haut de page résume la tension en clair', async ({ page }) => {
    await page.goto('/stress-monitor', { waitUntil: 'domcontentloaded' });
    const bulletin = page.locator('section[aria-labelledby="bulletin-titre"]');
    test.skip((await bulletin.count()) === 0, 'Aucune donnée de tension en base.');
    await expect(bulletin.getByRole('heading', { level: 2 })).toHaveText(/^Le marché est /);
    await expect(bulletin.getByRole('meter')).toBeVisible();
    await expect(bulletin.getByRole('heading', { name: /^Pourquoi \d+ \?$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Le détail, pour les initiés' })).toBeVisible();
  });

  test('aucun débordement horizontal à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/stress-monitor', { waitUntil: 'networkidle' });
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(deborde).toBe(false);
  });
});
