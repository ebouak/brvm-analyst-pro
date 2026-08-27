import { chromium } from '@playwright/test';

/**
 * Captures de la landing sur quatre viewports ET dans les deux thèmes.
 *
 * ⚠️ Ce script ne fixait PAS `colorScheme`. Playwright utilise `light` par
 * défaut : toutes les captures produites jusqu'au 2026-08-24 étaient donc en
 * thème clair, alors qu'elles servaient à juger un design pensé en sombre.
 * L'erreur a faussé plusieurs passes de revue visuelle.
 *
 * Le thème du site se fixe par l'attribut `data-theme` sur <html> (voir
 * app/globals.css) ; `colorScheme` seul ne suffit pas puisqu'une préférence
 * explicite l'emporte sur `prefers-color-scheme`.
 *
 * Usage : node ./shots.mjs <dossier> [url]
 */

const OUT = process.argv[2];
const URL = process.argv[3] ?? 'http://localhost:3000/';

const VIEWPORTS = [
  { nom: 'desktop', width: 1440, height: 1200 },
  { nom: 'laptop', width: 1280, height: 900 },
  { nom: 'tablette', width: 834, height: 1112 },
  { nom: 'mobile', width: 390, height: 844 },
];

const THEMES = [
  { nom: 'sombre', attr: 'dark', scheme: 'dark' },
  { nom: 'clair', attr: 'light', scheme: 'light' },
];

const nav = await chromium.launch();

for (const theme of THEMES) {
  for (const v of VIEWPORTS) {
    const ctx = await nav.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 2,
      colorScheme: theme.scheme,
    });
    // Poser data-theme AVANT le premier rendu : appliqué après, on capture
    // un flash de l'autre thème sur les éléments déjà peints.
    // Le site ne pose `data-theme` QUE pour le clair : le sombre est le defaut
    // et n'a aucun attribut (cf. app/layout.tsx, script anti-flash). On ecrit
    // donc la vraie cle de stockage, `westbourse-theme`, et on laisse le script
    // du site decider. `colorScheme` seul suffirait, mais la cle rend le choix
    // explicite plutot que dependant de la preference systeme du navigateur.
    await ctx.addInitScript((attr) => {
      try {
        localStorage.setItem('westbourse-theme', attr);
      } catch {
        /* stockage indisponible : colorScheme prend le relais */
      }
    }, theme.attr);

    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(2500);

    // Débordement horizontal : invisible sur une capture pleine hauteur.
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
    const themeRendu = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    await page.screenshot({ path: `${OUT}/${theme.nom}-${v.nom}.png`, fullPage: true });
    console.log(
      `${theme.nom.padEnd(7)} ${v.nom.padEnd(9)} ${String(v.width).padStart(4)}px  ` +
        `hauteur ${hauteur}px  debordement=${deborde}  ` +
        `rendu=${themeRendu === 'light' ? 'clair' : 'sombre'}`,
    );
    await ctx.close();
  }
}

await nav.close();
