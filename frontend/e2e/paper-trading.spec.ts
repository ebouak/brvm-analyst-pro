import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Portefeuille virtuel (/premium/paper-trading) — parcours MANUEL.
 *
 * Depuis le 2026-11-17, plus aucune tâche n'ouvre de position à la place de
 * l'utilisateur (`paper-trading-auto.yml` supprimé) : tout part d'un ordre
 * passé à la main. Ce test prouve ce que l'on peut prouver dans la journée :
 *   1. le compte simulé s'ouvre (ou est déjà ouvert) ;
 *   2. un ordre d'achat se passe depuis le formulaire ;
 *   3. il apparaît en attente, avec ses liquidités RÉSERVÉES ;
 *   4. il s'annule, et la réservation est rendue.
 *
 * L'EXÉCUTION n'est pas testée ici, et ne peut pas l'être honnêtement : un
 * ordre n'est évalué que sur une séance POSTÉRIEURE à sa création (fixing
 * futur, ou BOC antérieur + séance future en mode prudent). Elle est couverte
 * par les tests purs `lib/paper-trading/orders.test.ts` et
 * `ordersServer.test.ts`.
 *
 * Session de test : compte `qa-e2e-actif@` (scripts/qa-sessions-locales.mjs,
 * PW_PREMIUM_STATE). Sans elle, le scénario connecté est IGNORÉ. Le compte
 * simulé du compte de test est supprimé par `--fermer`.
 */

const ETAT_PREMIUM = process.env.PW_PREMIUM_STATE;
const sessionPremium = Boolean(ETAT_PREMIUM && fs.existsSync(ETAT_PREMIUM));

/** Annule tout ordre encore actif du compte de test (filet si le scénario échoue en route). */
async function annulerOrdresActifs(page: Page) {
  const res = await page.request.get('/api/paper-trading/orders');
  if (!res.ok()) return;
  const { orders } = (await res.json()) as { orders: { id: string; status: string }[] };
  for (const o of orders.filter((x) => ['pending', 'partial', 'waiting_data'].includes(x.status))) {
    await page.request.post(`/api/paper-trading/orders/${encodeURIComponent(o.id)}/cancel`);
  }
}

test.describe('visiteur non connecté', () => {
  test('le portefeuille virtuel renvoie vers la connexion', async ({ page }) => {
    await page.goto('/premium/paper-trading', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?next=%2Fpremium%2Fpaper-trading$/);
  });
});

test.describe('compte de test connecté', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!sessionPremium, 'Session de test absente : scénario ignoré, rien n’est validé.');
  test.use({ storageState: sessionPremium ? ETAT_PREMIUM : undefined });

  test.afterEach(async ({ page }) => {
    await annulerOrdresActifs(page);
  });

  test('ouvrir le compte, passer un achat, le voir réservé, l’annuler', async ({ page }) => {
    await page.goto('/premium/paper-trading', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session de test expirée : redirigé vers /login.');

    // 1. Compte simulé : créé au premier passage, réutilisé ensuite.
    const nouvelOrdre = page.getByRole('button', { name: 'Nouvel ordre', exact: true });
    const capital = page.getByRole('button', { name: '5M FCFA' });
    await expect(nouvelOrdre.or(capital)).toBeVisible();
    if (await capital.isVisible()) await capital.click();
    await expect(nouvelOrdre).toBeVisible();

    // Point de départ propre : aucun ordre actif, rien de réservé.
    await annulerOrdresActifs(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Aucun ordre en cours')).toBeVisible();
    await expect(page.getByText(/réservé aux ordres 0$/)).toBeVisible();

    // 2. Ordre d'achat au fixing futur, 1 titre, valable 1 séance.
    await nouvelOrdre.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Nouvel ordre' })).toBeVisible();
    const valeur = page.getByLabel('Valeur BRVM');
    const codes = await valeur.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    test.skip(codes.length === 0, 'Aucun cours de séance en base : rien à acheter.');
    const code = codes.includes('SNTS') ? 'SNTS' : codes[0];
    await valeur.selectOption(code);
    await page.getByRole('button', { name: 'Fixing futur' }).click();
    await page.getByLabel('Quantité (titres)').fill('1');
    await page.getByLabel('Validité').selectOption('1');
    await page.getByRole('button', { name: 'Simuler l’ordre d’achat' }).click();

    // 3. En attente, liquidités réservées.
    await expect(page.getByText('Ordre simulé enregistré.', { exact: false })).toBeVisible();
    const annuler = page.getByRole('button', { name: `Annuler l’ordre d’achat ${code}` });
    await expect(annuler).toBeVisible();
    const ligne = page.getByRole('row').filter({ has: annuler });
    await expect(ligne.getByText(/^En attente/)).toBeVisible();
    await expect(ligne.getByText(/^Réservé · \d/)).toBeVisible();
    await expect(page.getByText(/réservé aux ordres 0$/)).toHaveCount(0);

    // 4. Annulation : l'ordre quitte les actifs et la réservation est rendue.
    await annuler.click();
    await expect(annuler).toHaveCount(0);
    await expect(page.getByText('Aucun ordre en cours')).toBeVisible();
    await expect(page.getByText(/réservé aux ordres 0$/)).toBeVisible();
    await page.getByRole('button', { name: /^Historique \(/ }).click();
    const annule = page.getByRole('row').filter({ hasText: code }).filter({ hasText: 'Annulé' });
    await expect(annule.first()).toBeVisible();
    await expect(annule.first().getByText('Annulé par vous')).toBeVisible();
  });
});
