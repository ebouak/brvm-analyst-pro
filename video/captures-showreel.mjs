// Captures RÉELLES de westbourse.com pour le showreel (remotion/showreel.tsx).
//
// Pages PUBLIQUES seulement : ce script n'a pas de session, et n'en aura pas —
// le tableau de bord et le portefeuille, derrière la connexion, ne sont pas
// capturés. Les chiffres visibles sont ceux de la séance du jour de capture :
// la vidéo l'indique à l'écran (date écrite dans public/ecrans/date.txt).
//
// Usage : node captures-showreel.mjs  →  ../remotion/public/ecrans/*.png

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SITE ?? 'https://www.westbourse.com';
const SORTIE = new URL('../remotion/public/ecrans/', import.meta.url);
mkdirSync(SORTIE, { recursive: true });

/** nom, chemin, défilement vers un sélecteur (facultatif), largeur */
const PAGES = [
  { nom: 'accueil', chemin: '/' },
  { nom: 'aujourdhui', chemin: '/', ancre: '#h-today', decalage: -40 },
  { nom: 'societes', chemin: '/societes' },
  { nom: 'fiche', chemin: '/societes/SNTS' },
  { nom: 'fiche-bas', chemin: '/societes/SNTS', defile: 900 },
  { nom: 'secteurs', chemin: '/secteurs' },
  { nom: 'analyses', chemin: '/analyses/hebdo' },
  { nom: 'actualites', chemin: '/actualites' },
  { nom: 'simulateur', chemin: '/simulateur' },
  { nom: 'formations', chemin: '/formations' },
  { nom: 'sgi', chemin: '/comparateur-sgi' },
  { nom: 'mobile', chemin: '/societes/SNTS', mobile: true },
];

const navigateur = await chromium.launch();
const rapport = [];

for (const p of PAGES) {
  const contexte = await navigateur.newContext(
    p.mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark', locale: 'fr-FR' }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'fr-FR' },
  );
  // Intro animée déjà vue, popups d'incitation masqués : on capture la page,
  // pas un calque par-dessus.
  await contexte.addInitScript(() => {
    try { sessionStorage.setItem('ws_splash_seen', '1'); } catch {}
  });
  const page = await contexte.newPage();
  const rep = await page.goto(BASE + p.chemin, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => ({ status: () => `erreur ${e.message}` }));
  const statut = rep?.status?.();

  // Bandeau cookies : on refuse (le choix le plus sobre), sinon on le masque.
  for (const motif of [/tout refuser/i, /refuser/i, /continuer sans/i, /essentiel/i]) {
    const b = page.getByRole('button', { name: motif }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.addStyleTag({ content: '[data-splash]{display:none!important} *{scroll-behavior:auto!important}' });

  if (p.ancre) {
    await page.evaluate(({ a, d }) => {
      const el = document.querySelector(a);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + d);
    }, { a: p.ancre, d: p.decalage ?? 0 });
  } else if (p.defile) {
    await page.evaluate((y) => window.scrollTo(0, y), p.defile);
  }
  // Laisse jouer les apparitions (courbes tracées, compteurs) avant la photo.
  await page.waitForTimeout(3500);
  await page.keyboard.press('Escape').catch(() => {});

  const fichier = new URL(`${p.nom}.png`, SORTIE);
  await page.screenshot({ path: fileURLToPath(fichier) });
  rapport.push(`${p.nom.padEnd(12)} ${String(statut).padEnd(4)} ${p.chemin}`);
  await contexte.close();
}

await navigateur.close();
const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
writeFileSync(new URL('date.txt', SORTIE), date);
console.log(rapport.join('\n'));
console.log(`capturé le ${date}`);
