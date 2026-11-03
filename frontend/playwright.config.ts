import { defineConfig, devices } from '@playwright/test';

/**
 * Tests e2e « smoke » des parcours critiques. Lancent le serveur Next en local.
 * Les pages protégées (portefeuille, paper-trading, diagnostic) sont testées via
 * leur redirection d'authentification (pas de session de test requise).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 3,
  retries: 1,
  // En CI : JSON (importé dans /admin/qualite par scripts/qa-publier.mjs) et
  // HTML (zippé, pièce jointe privée). Ni l'un ni l'autre n'est publié comme
  // artefact GitHub : le dépôt est public, tout compte GitHub pourrait les lire.
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'test-results/rapport.json' }], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    navigationTimeout: 45_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serveur de PRODUCTION (build préalable requis) : pages servies instantanément,
  // pas de compilation à la volée comme en dev → tests fiables.
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // Page hôte « site tiers » d'embed-csp.spec.ts (autre origine : port 8081).
    {
      command: 'node scripts/hote-embed.mjs',
      url: 'http://localhost:8081/embed-check.html',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
