/**
 * Vérifie les pages de prod : charge chaque URL en headless et capture
 * les erreurs console / exceptions de page (les "Application error" Next.js).
 * Usage : npx tsx scripts/check-pages.ts
 */
import { chromium } from 'playwright';

const BASE = process.env.CHECK_BASE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';
const PAGES = process.env.CHECK_PAGES
  ? process.env.CHECK_PAGES.split(',')
  : ['/', '/societes', '/societes/SNTS', '/simulateur', '/simulateur/SNTS', '/brief'];

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failures = 0;

  for (const path of PAGES) {
    const errors: string[] = [];
    const onConsole = (msg: { type(): string; text(): string }) => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 300));
    };
    const onPageError = (err: Error) => errors.push(`PAGEERROR: ${err.message.slice(0, 300)}`);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    try {
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
      const status = resp?.status() ?? 0;
      const body = await page.textContent('body');
      const hasAppError = body?.includes('Application error') ?? false;
      if (hasAppError || errors.length > 0 || status >= 400) {
        failures++;
        console.log(`❌ ${path} (HTTP ${status})${hasAppError ? ' — APPLICATION ERROR affichée' : ''}`);
        for (const e of errors.slice(0, 4)) console.log(`   · ${e}`);
      } else {
        console.log(`✅ ${path} (HTTP ${status})`);
      }
    } catch (err) {
      failures++;
      console.log(`❌ ${path} — ${err instanceof Error ? err.message.slice(0, 200) : err}`);
    }

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  await browser.close();
  process.exit(failures > 0 ? 2 : 0);
}

main();
