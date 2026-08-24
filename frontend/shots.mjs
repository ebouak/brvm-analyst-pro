import { chromium } from '@playwright/test';

const OUT = process.argv[2];
const URL = process.argv[3] ?? 'http://localhost:3000/';
const CIBLES = [
  { nom: 'desktop', width: 1440, height: 1200 },
  { nom: 'laptop', width: 1280, height: 900 },
  { nom: 'tablette', width: 834, height: 1112 },
  { nom: 'mobile', width: 390, height: 844 },
];

const nav = await chromium.launch();
for (const c of CIBLES) {
  const page = await nav.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2500);

  // Débordement horizontal : un défaut invisible sur une capture pleine hauteur.
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);

  await page.screenshot({ path: `${OUT}/${c.nom}.png`, fullPage: true });
  console.log(`${c.nom.padEnd(9)} ${String(c.width).padStart(4)}px  hauteur ${hauteur}px  debordement_horizontal=${deborde}`);
  await page.close();
}
await nav.close();
