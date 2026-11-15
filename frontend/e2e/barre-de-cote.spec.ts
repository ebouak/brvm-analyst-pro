import { test, expect, type Page, type Locator } from '@playwright/test';
import { PANNEAUX } from '../lib/barreDeCote';

/**
 * Barre de cote (lot 7) : la seule navigation du site.
 *
 * Tout tourne en visiteur, sur une page publique (`/societes`) : aucune session
 * n'est requise. Les attendus de liens sont DÉRIVÉS du registre
 * (`PANNEAUX = construirePanneaux(REGISTRE)`), jamais recopiés ici : retirer une
 * entrée du registre la retire de l'attendu ET de la barre, et le test vérifie
 * que les deux restent identiques, au bureau comme dans le plein écran mobile
 * (la palette est couverte par `lib/barreDeCote.test.ts`).
 */

const PAGE = '/societes';
const barre = (page: Page) => page.locator('#barre-de-cote');
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale', exact: true });

/** Liens des deux colonnes du panneau ouvert (la colonne vivante est exclue). */
async function liensPanneau(page: Page, cellule: Locator): Promise<string[]> {
  const id = await cellule.getAttribute('aria-controls');
  expect(id, 'panneau sans aria-controls').toBeTruthy();
  const liens = page.locator(`[id="${id}"] .cote-fondu > div:nth-child(-n+2) ul a`);
  return liens.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
}

/**
 * Ouvre la page et attend que la barre soit HYDRATÉE (React a posé ses
 * gestionnaires sur les cellules) : une touche ou un clic envoyé avant
 * l'hydratation tombe sur du HTML inerte et le test échouerait au hasard.
 */
async function ouvrirPage(page: Page, chemin = PAGE) {
  await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const b = document.querySelector('#barre-de-cote button');
    return Boolean(b && Object.keys(b).some((k) => k.startsWith('__reactProps')));
  });
}

const attendu = (id: string) => PANNEAUX.find((p) => p.id === id)!.colonnes.flat().map((l) => l.href);

test.describe('bureau', () => {
  // 1600 px : libellés complets (ils raccourcissent sous 1536 et 1280 px).
  test.use({ viewport: { width: 1600, height: 900 } });

  test('aucune requête /api/nav/* avant la première interaction', async ({ page }) => {
    const requetes: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/nav/')) requetes.push(r.url()); });
    await ouvrirPage(page);
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);
    expect(requetes, 'requête de la colonne vivante partie au chargement').toEqual([]);
    const reponse = page.waitForResponse((r) => r.url().includes('/api/nav/apercu'));
    await nav(page).getByRole('button', { name: 'Le marché' }).hover();
    await reponse;
  });

  for (const touche of ['Enter', ' ', 'ArrowDown'] as const) {
    test(`clavier : « ${touche === ' ' ? 'Espace' : touche} » ouvre, Échap ferme et rend le focus`, async ({ page }) => {
      await ouvrirPage(page);
      const cellule = nav(page).getByRole('button', { name: 'Le marché' });
      await cellule.focus();
      // Le focus seul n'ouvre pas le panneau (réglage validé du 2026-11-15).
      await expect(cellule).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press(touche);
      await expect(cellule).toHaveAttribute('aria-expanded', 'true');
      const id = await cellule.getAttribute('aria-controls');
      await expect(page.locator(`[id="${id}"] .cote-fondu`)).toBeVisible();
      // Entrée / Espace / ↓ : le focus descend sur le premier lien du panneau.
      await expect(page.locator(`[id="${id}"] .cote-fondu a`).first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(cellule).toHaveAttribute('aria-expanded', 'false');
      await expect(cellule).toBeFocused();
    });
  }

  test('← / → changent de rubrique sans refermer le panneau', async ({ page }) => {
    await ouvrirPage(page);
    const marche = nav(page).getByRole('button', { name: 'Le marché' });
    const idee = nav(page).getByRole('button', { name: 'Trouver une idée' });
    // Ouvert au survol, puis focus sur la cellule (le focus seul ne referme
    // pas) : ←/→ se lisent depuis une cellule. Pas de clic : survol (120 ms) et
    // clic se croisent, le clic peut alors refermer ce que le survol a ouvert.
    await marche.hover();
    await expect(marche).toHaveAttribute('aria-expanded', 'true');
    await marche.focus();
    await page.keyboard.press('ArrowRight');
    await expect(idee).toHaveAttribute('aria-expanded', 'true');
    await expect(marche).toHaveAttribute('aria-expanded', 'false');
    await expect(idee).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(marche).toHaveAttribute('aria-expanded', 'true');
  });

  test('sémantique disclosure : nav + button aria-expanded, aucun role="menu"', async ({ page }) => {
    await ouvrirPage(page);
    await expect(barre(page).locator('[role="menu"], [role="menuitem"]')).toHaveCount(0);
    // Lien d'évitement : premier élément focalisable de la page.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  });

  test('registre : chaque panneau montre exactement les entrées du registre', async ({ page }) => {
    await ouvrirPage(page);
    const cellules: [string, Locator][] = [
      ['aujourdhui', nav(page).getByRole('button', { name: /Séance ouverte|Marché fermé|Séance/ })],
      ['marche', nav(page).getByRole('button', { name: 'Le marché' })],
      ['idee', nav(page).getByRole('button', { name: 'Trouver une idée' })],
      ['revenus', nav(page).getByRole('button', { name: 'Mes revenus' })],
      ['apprendre', nav(page).getByRole('button', { name: 'Apprendre' })],
    ];
    for (const [id, cellule] of cellules) {
      await cellule.focus();
      await page.keyboard.press('ArrowDown'); // ↓ ouvre toujours, sans course avec le survol
      await expect(cellule).toHaveAttribute('aria-expanded', 'true');
      expect(await liensPanneau(page, cellule), `panneau ${id}`).toEqual(attendu(id));
      await page.keyboard.press('Escape');
    }
  });

  test('aucune barre à l’impression', async ({ page }) => {
    await ouvrirPage(page);
    await expect(barre(page)).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(barre(page)).toBeHidden();
  });
});

test('aucune barre sur les widgets /embed/*', async ({ page }) => {
  await page.goto('/embed/ticker', { waitUntil: 'domcontentloaded' });
  await expect(barre(page)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Navigation principale', exact: true })).toHaveCount(0);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('plein écran : défilement verrouillé, focus piégé, Échap rend le focus', async ({ page }) => {
    await ouvrirPage(page);
    const grille = barre(page).getByRole('button', { name: 'Ouvrir le menu' });
    await grille.click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue).toBeVisible();
    await expect(grille).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    // Le focus est dans la boîte et y reste après un tour complet de Tab.
    expect(await dialogue.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
    expect(await dialogue.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    // Cibles tactiles : 48 px minimum.
    const petites = await dialogue.locator('a[href]:visible, button:visible').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height).filter((h) => h > 0 && h < 47.5),
    );
    expect(petites, 'cible tactile sous 48 px').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialogue).toHaveCount(0);
    await expect(grille).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });

  test('plein écran : une rubrique ouverte à la fois, liens issus du registre', async ({ page }) => {
    await ouvrirPage(page);
    await barre(page).getByRole('button', { name: 'Ouvrir le menu' }).click();
    const dialogue = page.getByRole('dialog');
    // Visiteur : pas de rubrique « Mon portefeuille ».
    for (const p of PANNEAUX.filter((x) => x.id !== 'portefeuille')) {
      const bouton = dialogue.getByRole('button', { name: p.libelle, exact: true });
      await bouton.click();
      await expect(bouton).toHaveAttribute('aria-expanded', 'true');
      await expect(dialogue.locator('h2 button[aria-expanded="true"]')).toHaveCount(1);
      const hrefs = await dialogue.locator(`[id="cote-m-${p.id}"] a`).evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
      expect(new Set(hrefs), `rubrique ${p.id}`).toEqual(new Set(attendu(p.id)));
    }
  });
});
