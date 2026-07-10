import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Garde anti-régression du bug « clics morts sur /dashboard » (juil. 2026).
 *
 * Cause historique : DashboardTicker recalculait son tableau `actionSeed` à
 * chaque rendu et le passait à useRealtimeActions, dont `useEffect(() =>
 * setRows(initialRows), [initialRows])` rebouclait à l'infini → React saturé →
 * `router.push` jamais exécuté → toute navigation par <Link> morte quand
 * /dashboard est la page d'entrée. Corrigé par un useMemo sur `actionSeed`.
 *
 * Ce test exige une session Supabase locale sérialisée en cookie Playwright
 * (fichier hors dépôt). Sans elle (CI, autre machine) → skip propre.
 */
const COOKIE_FILE = process.env.PW_COOKIES ?? String.raw`C:\Users\adego\AppData\Local\Temp\pw-cookies.json`;

test('dashboard authentifié : la navigation par <Link> fonctionne (anti-régression)', async ({ page, context }) => {
  test.skip(!fs.existsSync(COOKIE_FILE), 'Session locale absente (cookie Playwright non fourni).');
  await context.addCookies(JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')));

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // laisse les montages lourds (temps réel, charts) s'exécuter
  test.skip(page.url().includes('/login'), 'Session expirée → redirigé vers /login.');

  // Aucun overlay plein écran ne doit intercepter les clics.
  const blockers = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return (Array.from(document.querySelectorAll('body *')) as HTMLElement[]).filter((el) => {
      const s = getComputedStyle(el);
      if ((s.position !== 'fixed' && s.position !== 'absolute') || s.pointerEvents === 'none') return false;
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width >= vw * 0.85 && r.height >= vh * 0.85 && r.top <= 2 && r.left <= 2 && parseInt(s.zIndex || '0', 10) >= 30;
    }).length;
  });
  expect(blockers, 'overlay plein écran interceptant les clics').toBe(0);

  // LA régression : depuis /dashboard (page d'entrée), un clic <Link> de la
  // sidebar doit naviguer.
  await page.getByRole('link', { name: /^Actions$/i }).first().click({ timeout: 8000 });
  await expect(page).toHaveURL(/\/actions(?:$|\/|\?)/, { timeout: 10_000 });
});
