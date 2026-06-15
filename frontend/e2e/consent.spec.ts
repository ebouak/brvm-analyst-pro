import { test, expect } from '@playwright/test';

test('le bandeau cookies apparaît puis persiste le choix', async ({ page }) => {
  await page.goto('/login');
  const banner = page.getByText('cookies strictement nécessaires');
  await expect(banner).toBeVisible();

  await page.getByRole('button', { name: 'Tout accepter' }).click();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(page.getByText('cookies strictement nécessaires')).toBeHidden();
});
