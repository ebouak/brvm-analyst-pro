import { test, expect } from '@playwright/test';

/**
 * T1 — la CSP doit être OUVERTE sur /embed et CONFINÉE ailleurs.
 *
 * Le test sert une page depuis une origine tierce (data: URL = origine opaque,
 * donc « cross-origin » du point de vue de frame-ancestors) et vérifie que :
 *   - les widgets /embed/* s'affichent (contenu accessible dans l'iframe) ;
 *   - /dashboard reste bloqué (aucun contenu accessible).
 *
 * Si /dashboard devient embarquable : P0 (clickjacking) — la règle
 * '/((?!embed).*)' de next.config.js ne s'applique plus.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
/** Page hôte tierce (origine différente de BASE — le port suffit à la distinguer). */
const HOST = process.env.E2E_HOST_URL ?? 'http://localhost:8081/embed-check.html';

test.describe('CSP embed : ouverture et confinement', () => {
  test('les en-têtes distinguent /embed du reste du site', async ({ request }) => {
    const app = await request.get(`${BASE}/dashboard`);
    const appCsp = app.headers()['content-security-policy'] ?? '';
    expect(app.headers()['x-frame-options']).toBe('SAMEORIGIN');
    expect(appCsp).toContain("frame-ancestors 'self'");

    const embed = await request.get(`${BASE}/embed/ticker`);
    const embedCsp = embed.headers()['content-security-policy'] ?? '';
    // L'en-tête legacy PRIME sur la CSP : sa présence annulerait l'ouverture.
    expect(embed.headers()['x-frame-options']).toBeUndefined();
    expect(embedCsp).toContain('frame-ancestors *');
  });

  test('un site tiers peut embarquer les widgets, mais pas le tableau de bord', async ({ page }) => {
    // Page hôte servie depuis une VRAIE origine tierce (port ≠ celui de l'app).
    // `page.setContent` ne convient pas : son about:blank a une origine OPAQUE,
    // que `frame-ancestors *` ne matche pas — les deux iframes seraient bloquées
    // et le test « réussirait » pour une mauvaise raison.
    // Prérequis : cd frontend/scripts && python -m http.server 8081
    await page.goto(HOST, { waitUntil: 'load' });
    await page.waitForTimeout(4000); // laisse les deux frames tenter leur chargement

    // Le widget DOIT s'être chargé : son document contient le backlink WESTBOURSE.
    const widgetFrame = page.frames().find((f) => f.url().includes('/embed/ticker'));
    expect(widgetFrame, 'la frame du widget doit exister').toBeTruthy();
    const widgetHtml = await widgetFrame!.content();
    expect(widgetHtml).toContain('utm_source=widget');
    expect(widgetHtml).toContain('wb-ticker-track');

    // Le tableau de bord DOIT être refusé : son document reste vide/inaccessible.
    const dashFrame = page.frames().find((f) => f.url().includes('/dashboard'));
    const dashHtml = dashFrame ? await dashFrame.content().catch(() => '') : '';
    expect(
      dashHtml.includes('WESTBOURSE') && dashHtml.length > 2000,
      "le tableau de bord ne doit PAS être embarquable (clickjacking)",
    ).toBe(false);
  });
});
