/**
 * Test d'intégration bfin.brvm.org — connexion et fetch réels.
 *
 * Ces tests font de vraies requêtes HTTP vers bfin.brvm.org.
 * Ils ne s'exécutent QUE si BDFIN_USERNAME et BDFIN_PASSWORD sont présents
 * dans l'environnement (ou .env.local). Sans credentials, toute la suite
 * est ignorée (skipIf).
 *
 * Pour lancer :
 *   BDFIN_USERNAME=xxx BDFIN_PASSWORD=yyy npx vitest run tests/bfin-real.test.ts
 * ou avec .env.local renseigné :
 *   npx vitest run tests/bfin-real.test.ts
 *
 * En cas d'échec de sélecteur, activer LOG_LEVEL=debug pour voir le HTML :
 *   LOG_LEVEL=debug npx vitest run tests/bfin-real.test.ts
 */
import { describe, it, expect } from 'vitest';
import 'dotenv/config';
import { loginBdfin, fetchCoursduJour } from '../src/scrapers/bfin-real.js';

const hasCredentials =
  Boolean(process.env['BDFIN_USERNAME']) &&
  Boolean(process.env['BDFIN_PASSWORD']);

describe.skipIf(!hasCredentials)(
  'bfin-real (intégration réseau — skip sans credentials)',
  () => {
    // Timeout généreux : réseau + ASP.NET auth peut prendre plusieurs secondes.
    const TIMEOUT = 30_000;

    it(
      'loginBdfin() établit une session valide',
      async () => {
        const session = await loginBdfin();

        // Le client doit être opérationnel (cookies déposés).
        expect(session.http).toBeDefined();
        expect(session.http.jar).toBeDefined();

        // Le résumé doit lister au moins ASP.NET_SessionId.
        expect(session.cookieSummary).toMatch(/ASP\.NET_SessionId|\.ASPXAUTH/i);
      },
      TIMEOUT,
    );

    it(
      'fetchCoursduJour() retourne des cotations non vides',
      async () => {
        const { http } = await loginBdfin();
        const quotes = await fetchCoursduJour(http);

        // Si 0 résultats : les sélecteurs ACTIONS_TABLE_SELECTORS sont à calibrer.
        expect(quotes.length).toBeGreaterThan(0);

        // Chaque entrée doit avoir un code non vide.
        for (const q of quotes) {
          expect(q.code).toBeTruthy();
          expect(typeof q.code).toBe('string');
        }
      },
      TIMEOUT,
    );

    it(
      'au moins un titre a un cours_jour > 0',
      async () => {
        const { http } = await loginBdfin();
        const quotes = await fetchCoursduJour(http);

        const withPrice = quotes.filter(
          (q) => q.cours_jour != null && q.cours_jour > 0,
        );

        // Si ce test échoue, parseFrNumber ne reconnaît pas le format numérique.
        expect(withPrice.length).toBeGreaterThan(0);
      },
      TIMEOUT,
    );

    it(
      'variation_pct est dans une plage vraisemblable (−30 % à +30 %)',
      async () => {
        const { http } = await loginBdfin();
        const quotes = await fetchCoursduJour(http);

        const withVar = quotes.filter((q) => q.variation_pct != null);
        for (const q of withVar) {
          expect(q.variation_pct!).toBeGreaterThanOrEqual(-30);
          expect(q.variation_pct!).toBeLessThanOrEqual(30);
        }
      },
      TIMEOUT,
    );
  },
);

describe('bfin-real (sans réseau — vérifications statiques)', () => {
  it('loginBdfin lève une erreur si les credentials sont absents', async () => {
    // Sauvegarde et suppression temporaire des vars d'env.
    const u = process.env['BDFIN_USERNAME'];
    const p = process.env['BDFIN_PASSWORD'];
    delete process.env['BDFIN_USERNAME'];
    delete process.env['BDFIN_PASSWORD'];

    // Vider le cache config zod pour qu'il relise l'env.
    // Le module config.ts cache l'objet ; on patche directement process.env
    // et on s'attend à ce que loginBdfin() détecte les champs vides.
    try {
      await expect(loginBdfin()).rejects.toThrow(/BDFIN_USERNAME.*BDFIN_PASSWORD|manquants/i);
    } finally {
      // Restauration.
      if (u !== undefined) process.env['BDFIN_USERNAME'] = u;
      if (p !== undefined) process.env['BDFIN_PASSWORD'] = p;
    }
  });
});
