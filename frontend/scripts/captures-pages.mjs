#!/usr/bin/env node
// Captures pleine page d'une liste de routes, en sombre et en clair, ordinateur et mobile.
//
// Sert aux agents de l'équipe design : chacun regarde sa page AVANT de dire « fini ».
// Un seul serveur d'aperçu tourne (lancé par le chef de projet) ; ce script ne fait que
// le visiter.
//
//   node scripts/captures-pages.mjs --base http://localhost:3124 \
//     --pages /actions,/societes/SNTS --out <dossier> [--etat <storageState.json>] [--prefixe apres]
//
// --etat : fichier de session Playwright (scripts/qa-sessions-locales.mjs le produit pour
//          le compte de test qa-e2e-actif). Sans lui, les pages derrière connexion
//          redirigent vers /login, ce que la capture montrera.
// Les animations sont coupées (reducedMotion) : une capture ne doit pas saisir un élément
// à moitié apparu. Chaque fichier : <prefixe>-<route>-<sombre|clair>-<ordinateur|mobile>.png

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : acc), []),
);
const base = (args.base || 'http://localhost:3124').replace(/\/$/, '');
const pages = (args.pages || '/').split(',').map((p) => p.trim()).filter(Boolean);
const sortie = args.out;
const prefixe = args.prefixe || 'capture';
if (!sortie) {
  console.error('Indiquez le dossier de sortie : --out <dossier>');
  process.exit(1);
}
fs.mkdirSync(sortie, { recursive: true });

const VUES = [
  ['ordinateur', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];
const THEMES = [['sombre', 'dark'], ['clair', 'light']];
const nomRoute = (r) => (r === '/' ? 'accueil' : r.replace(/^\//, '').replace(/[/[\]]+/g, '-'));

const navigateur = await chromium.launch();
const bilan = [];
try {
  for (const [nomTheme, theme] of THEMES) {
    for (const [nomVue, viewport] of VUES) {
      const ctx = await navigateur.newContext({
        viewport, colorScheme: theme, reducedMotion: 'reduce',
        ...(args.etat ? { storageState: args.etat } : {}),
      });
      await ctx.addInitScript((t) => {
        try { sessionStorage.setItem('ws_splash_seen', '1'); localStorage.setItem('westbourse-theme', t); } catch {}
      }, theme);
      const page = await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
      for (const route of pages) {
        const reponse = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForTimeout(2500);
        const refuser = page.getByRole('button', { name: 'Refuser' });
        if (await refuser.count()) await refuser.first().click().catch(() => {});
        const mesure = await page.evaluate(() => ({ url: location.pathname, debord: document.documentElement.scrollWidth - innerWidth, hauteur: document.documentElement.scrollHeight }));
        const fichier = path.join(sortie, `${prefixe}-${nomRoute(route)}-${nomTheme}-${nomVue}.png`);
        await page.screenshot({ path: fichier, fullPage: true });
        bilan.push({ route, theme: nomTheme, vue: nomVue, statut: reponse?.status() ?? null, arrivee: mesure.url, debordementPx: mesure.debord, hauteurPx: mesure.hauteur, erreurs: [...erreurs], fichier });
        erreurs.length = 0;
      }
      await ctx.close();
    }
  }
} finally {
  await navigateur.close();
}
fs.writeFileSync(path.join(sortie, `${prefixe}-bilan.json`), JSON.stringify(bilan, null, 2));
for (const b of bilan) {
  const alertes = [b.statut !== 200 && `HTTP ${b.statut}`, b.arrivee !== b.route && `redirigé vers ${b.arrivee}`, b.debordementPx > 0 && `débord ${b.debordementPx}px`, b.erreurs.length && `${b.erreurs.length} erreur(s)`].filter(Boolean);
  console.log(`${b.route} ${b.theme}/${b.vue} : ${alertes.length ? alertes.join(', ') : 'ok'}`);
}
