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
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    navigationTimeout: 45_000,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serveur de PRODUCTION (build préalable requis) : pages servies instantanément,
  // pas de compilation à la volée comme en dev → tests fiables.
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
