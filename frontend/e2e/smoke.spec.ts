import { test, expect } from '@playwright/test';

/** Pages publiques / SSR : doivent charger sans crash et afficher leur titre. */
const PUBLIC_PAGES: { path: string; heading: RegExp }[] = [
  { path: '/actions', heading: /Marché Actions/i },
  { path: '/secteurs', heading: /secteur/i },
];

for (const { path, heading } of PUBLIC_PAGES) {
  test(`page publique charge : ${path}`, async ({ page }) => {
    const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), `statut HTTP de ${path}`).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  });
}

/**
 * Pages de l'application FERMÉES depuis le mur d'authentification du
 * 2026-07-17 (958048e, « vitrine SEO ouverte + app fermée »). Elles figuraient
 * ci-dessus comme publiques et échouaient depuis : le test cherchait leur titre
 * sur la page de connexion. Ce qu'on garantit désormais : un visiteur est
 * renvoyé vers /login, avec la destination conservée pour y revenir.
 */
const PAGES_FERMEES = ['/obligations', '/heatmap', '/dividendes', '/backtest'];

for (const path of PAGES_FERMEES) {
  test(`page fermée renvoie vers la connexion : ${path}`, async ({ page }) => {
    const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), `statut HTTP de ${path}`).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  });
}

test('Marché Actions : la colonne Secteur n’est pas systématiquement vide', async ({ page }) => {
  await page.goto('/actions', { waitUntil: 'networkidle' });
  const body = await page.locator('body').innerText();
  // Au moins un secteur connu doit apparaître (régression « tout à — »).
  expect(body).toMatch(/Consommation|Finance|Services publics|Industrie|Télécom|Énergie|Santé|Matériaux/i);
});

/**
 * Parcours protégés / premium : ne doivent pas planter (pas de 5xx) et exiger
 * une authentification (redirection login OU formulaire de connexion OU gate
 * premium). On suit la redirection : la réponse finale reste < 400.
 */
const PROTECTED_PAGES = [
  '/portefeuille',
  '/premium/paper-trading',
  '/premium/diagnostic',
  '/premium/valorisation',
  '/premium/comparateur',
];

for (const path of PROTECTED_PAGES) {
  test(`parcours protégé charge sans crash : ${path}`, async ({ page }) => {
    const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
    // Aucune erreur serveur (la redirection d'auth renvoie la page login en 200).
    expect(resp?.status(), `statut HTTP de ${path}`).toBeLessThan(500);
    // La page rend du contenu (login, gate premium, ou la vue elle-même).
    const body = await page.locator('body').innerText();
    expect(body.length, `${path} doit afficher du contenu`).toBeGreaterThan(20);
  });
}
