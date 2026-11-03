import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * KPI animés (AnimatedValue) : le comptage progresse puis s'arrête sur la
 * valeur cible.
 *
 * /backtests/demo est derrière le mur de connexion depuis le 2026-07-17 et doit
 * le rester : c'est une démonstration aux chiffres FICTIFS (rapport BICC
 * simulé), qu'on ne montre pas à un visiteur. Le test exige donc une session
 * de test (storageState, chemin dans PW_PREMIUM_STATE, comme screener.spec.ts) ;
 * sans elle il est IGNORÉ, et /admin/qualite l'affiche comme tel.
 */
const ETAT = process.env.PW_PREMIUM_STATE;
const session = Boolean(ETAT && fs.existsSync(ETAT));

test.describe('KPI animés', () => {
  test.skip(!session, 'Session de test absente : /backtests/demo est réservée aux comptes connectés.');
  test.use({ storageState: session ? ETAT : undefined });

  test('les KPI animés comptent progressivement (valeur change dans le temps)', async ({ page }) => {
    await page.goto('/backtests/demo', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session de test expirée : redirigé vers /login.');
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
});
