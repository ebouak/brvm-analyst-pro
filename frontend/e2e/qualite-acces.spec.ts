import { test, expect } from '@playwright/test';

/**
 * « Qualité & Tests » vu de l'extérieur : rien n'est lisible ni écrivable
 * sans droit. Contre le build de la CI, sans session ni clé privilégiée.
 */

test('la console qualité renvoie un visiteur vers la connexion', async ({ page }) => {
  await page.goto('/admin/qualite', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fqualite$/);
});

test('une pièce jointe de test est refusée à un visiteur', async ({ request }) => {
  const r = await request.get('/api/admin/qa/artefacts/0b6c7c1e-2a8f-4c39-9d0e-6f1a2b3c4d5e', { maxRedirects: 0 });
  expect(r.status()).toBe(403);
});

test('l’ingestion refuse un envoi non authentifié', async ({ request }) => {
  for (const chemin of ['debut', 'fin', 'artefacts/confirmer']) {
    const r = await request.post(`/api/qa/ingest/${chemin}`, { data: { meta: {} } });
    expect(r.status(), chemin).toBe(401);
  }
});
