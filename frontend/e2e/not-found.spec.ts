import { test, expect } from '@playwright/test';

/**
 * Régression du SOFT-404 (audit du 17/09/2026).
 *
 * LE DÉFAUT. Une route publique inexistante répondait **HTTP 200** avec un corps
 * « page introuvable ». Google indexait donc des URL mortes comme du contenu.
 *
 * LA CAUSE, prouvée dans les deux sens. Une frontière Suspense `loading.tsx`
 * posée AU-DESSUS d'une route qui appelle `notFound()` fait diffuser la réponse
 * en flux : Next envoie les en-têtes — donc le statut 200 — avant d'exécuter la
 * page. Retirer `app/loading.tsx` rendait le 404 ; ajouter un `loading.tsx`
 * racine à une application Next 14.2.35 vierge cassait le sien.
 *
 * CE QUE CE TEST PROTÈGE. Pas une ligne de code, une **règle d'architecture** :
 * aucun `loading.tsx` ne doit surplomber une route pouvant appeler `notFound()`.
 * Reposer un `loading.tsx` à la racine ferait retomber ces quatre cas en 200 —
 * et c'est exactement la régression qu'on ne verrait pas à l'œil, puisque la
 * page affichée reste la bonne. **Seul le statut trahit le défaut : on l'assert
 * explicitement, jamais `toBeLessThan(400)`.**
 */

/** Routes publiques et indexables qui doivent répondre 404 sur une clé absente. */
const ROUTES_ABSENTES = [
  { chemin: '/societes/ZZZZ', quoi: 'fiche société' },
  { chemin: '/analyses/xxx', quoi: 'page citable' },
  { chemin: '/brief/1999-01-01', quoi: 'brief de séance' },
  { chemin: '/simulateur/ZZZZ', quoi: 'simulateur par valeur' },
];

for (const { chemin, quoi } of ROUTES_ABSENTES) {
  test(`404 réel — ${quoi} (${chemin})`, async ({ page }) => {
    const resp = await page.goto(chemin, { waitUntil: 'domcontentloaded' });

    // 1. Le STATUT. C'est le cœur du test : un 200 ici est le défaut historique.
    expect(resp?.status(), `statut HTTP de ${chemin}`).toBe(404);

    // 2. Le CORPS. Un 404 servant une page valide serait tout aussi faux qu'un
    //    200 servant une page d'erreur — on vérifie donc les deux.
    const corps = await page.locator('body').innerText();
    expect(corps, `corps de ${chemin}`).toMatch(/n['’]existe pas|introuvable|could not be found/i);
  });
}

/**
 * TÉMOINS. Sans eux, on ne saurait pas distinguer « le 404 est réparé » de
 * « tout répond 404 ». Une route valide par famille testée ci-dessus.
 */
const ROUTES_VALIDES = [
  { chemin: '/societes/SNTS', quoi: 'fiche société existante' },
  { chemin: '/analyses', quoi: 'index des analyses' },
  { chemin: '/brief', quoi: 'index des briefs' },
  { chemin: '/', quoi: 'accueil' },
];

for (const { chemin, quoi } of ROUTES_VALIDES) {
  test(`témoin 200 — ${quoi} (${chemin})`, async ({ page }) => {
    const resp = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), `statut HTTP de ${chemin}`).toBe(200);
    // Aucune redirection inattendue vers le mur d'authentification : ces routes
    // sont publiques, un 307 vers /login signalerait une régression du middleware.
    expect(page.url(), `URL finale de ${chemin}`).not.toContain('/login');
  });
}
