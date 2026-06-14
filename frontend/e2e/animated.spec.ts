import { test, expect } from '@playwright/test';

test('les KPI animés comptent progressivement (valeur change dans le temps)', async ({ page }) => {
  await page.goto('/backtests/demo', { waitUntil: 'domcontentloaded' });
  const kpis = page.getByTestId('animated-kpis');
  await expect(kpis).toBeVisible();

  // Lecture immédiate (animation en cours, valeur encore basse).
  const early = await kpis.innerText();
  // Après la fin du comptage (ramp ~750ms + marge).
  await page.waitForTimeout(1200);
  const settled = await kpis.innerText();

  // L'état final doit contenir la valeur cible.
  expect(settled).toMatch(/34\D?250\D?000/); // 34 250 000 (séparateurs variables)
  expect(settled).toMatch(/92,8\s*%/);
  // L'animation a bien progressé : le rendu initial diffère du rendu final.
  expect(early).not.toBe(settled);
});
