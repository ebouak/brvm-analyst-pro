import { test, expect } from '@playwright/test';

/**
 * Reproduction du bug « clics morts » : au premier chargement d'une session, le
 * SplashScreen affiche un overlay plein écran (fixed, z-index 100). S'il
 * intercepte les clics (pointer-events != none), toute la navigation paraît
 * morte tant qu'il n'a pas disparu. On teste sur /actions (page PUBLIQUE qui
 * utilise le shell complet : sidebar + splash), donc sans authentification.
 */

test('aucun overlay plein écran n’intercepte les clics (splash inclus)', async ({ page }) => {
  // Contexte frais (sessionStorage vide) → le splash s'affiche au chargement.
  await page.goto('/actions', { waitUntil: 'commit' });

  // Cherche tout élément fixe couvrant ~tout l'écran, z-index élevé, dont les
  // clics ne « passent pas au travers » (pointer-events != none). Un tel élément
  // bloquerait la navigation. Le splash doit être en pointer-events:none.
  const blockers = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return (Array.from(document.querySelectorAll('body *')) as HTMLElement[])
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'absolute') return false;
        if (s.pointerEvents === 'none') return false;
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        const coversViewport = r.width >= vw * 0.9 && r.height >= vh * 0.9 && r.top <= 1 && r.left <= 1;
        const highZ = parseInt(s.zIndex || '0', 10) >= 40;
        return coversViewport && highZ;
      })
      .map((el) => ({ z: getComputedStyle(el).zIndex, pe: getComputedStyle(el).pointerEvents, cls: String(el.className).slice(0, 60) }));
  });
  expect(blockers, `overlay(s) plein écran interceptant les clics: ${JSON.stringify(blockers)}`).toEqual([]);

  // Concrètement : cliquer un lien de la sidebar doit naviguer, tout de suite
  // (fenêtre où le splash est encore potentiellement visible).
  await page.getByRole('link', { name: /^Obligations$/i }).first().click();
  await expect(page).toHaveURL(/\/obligations/, { timeout: 10_000 });
});
