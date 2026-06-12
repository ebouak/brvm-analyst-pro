/**
 * Capture les écrans réels du site (prod) pour la vidéo de la landing.
 * Sorties : frontend/public/screens/*.png (1600×1000, device scale 2 → net).
 * Usage : npx tsx scripts/capture-screens.ts
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const BASE = process.env.CHECK_BASE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';
const OUT = path.resolve(import.meta.dirname ?? __dirname, '../../frontend/public/screens');

const SHOTS: { name: string; path: string; fullPage?: boolean }[] = [
  { name: 'landing', path: '/' },
  { name: 'societes', path: '/societes' },
  { name: 'fiche-snts', path: '/societes/SNTS' },
  { name: 'simulateur', path: '/simulateur/SNTS' },
  { name: 'note-conjoncture', path: '/brief/2026-06-12' },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });

  for (const shot of SHOTS) {
    try {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200); // polices + transitions
      const file = path.join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`✅ ${shot.name} ← ${shot.path}`);
    } catch (err) {
      console.log(`❌ ${shot.name} — ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
  }

  await browser.close();
  console.log(`\nCaptures dans : ${OUT}`);
}

main();
