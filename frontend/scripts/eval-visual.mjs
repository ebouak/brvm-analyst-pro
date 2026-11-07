#!/usr/bin/env node
/**
 * eval:visual - contrôle visuel DÉTERMINISTE, en échec fermé.
 *
 * Usage :
 *   npm run eval:visual -- [--base URL] [--etat state.json] [--pages /a,/b]
 *                          [--out dossier] [--referentiel dossier]
 *
 * Défauts : --base http://localhost:3124 ; pages = eval-visual.config.json ;
 * --out = eval-visual-out (rapport.json + captures) ;
 * --referentiel = dossier d'une exécution précédente (son rapport.json suffit).
 *
 * ATTENTION Git Bash (MSYS) : tout argument commençant par "/" est converti en
 * chemin Windows. Préfixer : MSYS_NO_PATHCONV=1 npm run eval:visual -- --pages /pricing
 *
 * Matrice : page x {sombre, clair} x {1440x900, 375x812}. Contrôles BLOQUANTS :
 * statut 200 sans redirection, pas de débordement horizontal, aucune erreur JS,
 * sélecteurs requis, axe-core 0 critical/serious, aucun texte < 11 px.
 * Avertissement seul : écart de mise en page vs référentiel (sections + h1,
 * jamais les pixels). Code de sortie 1 si un contrôle bloquant échoue, ou si
 * la mesure elle-même échoue (échec fermé).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const base = (args.base || 'http://localhost:3124').replace(/\/$/, '');
const out = path.resolve(args.out || 'eval-visual-out');
const config = JSON.parse(fs.readFileSync(path.join(ICI, 'eval-visual.config.json'), 'utf8'));
const routes = args.pages ? args.pages.split(',').map((s) => s.trim()).filter(Boolean) : Object.keys(config.pages);
const etat = args.etat ? path.resolve(args.etat) : undefined;
const refRapport = args.referentiel ? path.join(path.resolve(args.referentiel), 'rapport.json') : null;
const ref = refRapport && fs.existsSync(refRapport) ? JSON.parse(fs.readFileSync(refRapport, 'utf8')) : null;
if (args.referentiel && !ref) console.warn(`Référentiel introuvable : ${refRapport} (comparaison ignorée)`);

const THEMES = ['sombre', 'clair'];
const VUES = [
  { nom: '1440x900', width: 1440, height: 900 },
  { nom: '375x812', width: 375, height: 812 },
];

/* Mesures exécutées dans la page */
function mesurer() {
  const de = document.documentElement;
  const debordement = de.scrollWidth - de.clientWidth;
  const petits = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.trim();
    const el = n.parentElement;
    if (!t || !el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const px = parseFloat(cs.fontSize);
    if (px < 11) petits.push({ px, tag: el.tagName.toLowerCase(), texte: t.slice(0, 50) });
  }
  const sections = [...document.querySelectorAll('main > *, main section, body > section')]
    .slice(0, 40)
    .map((s) => ({ tag: s.tagName.toLowerCase(), titre: (s.querySelector('h1,h2,h3')?.textContent || '').trim().slice(0, 60) }));
  const h1 = document.querySelector('h1');
  const hr = h1 ? h1.getBoundingClientRect() : null;
  return { debordement, petits, sections, h1: hr ? { w: Math.round(hr.width), h: Math.round(hr.height) } : null };
}

fs.mkdirSync(out, { recursive: true });
const axeRes = await fetch(AXE);
if (!axeRes.ok) { console.error('axe-core introuvable : échec fermé'); process.exit(1); }
const axeSource = await axeRes.text();
const browser = await chromium.launch();
const resultats = [];

for (const route of routes) {
  const requis = config.pages[route]?.requis || ['h1'];
  for (const theme of THEMES) {
    for (const vue of VUES) {
      const cle = `${route}|${theme}|${vue.nom}`;
      const r = { cle, bloquants: [], avertissements: [] };
      resultats.push(r);
      let ctx;
      try {
        ctx = await browser.newContext({
          viewport: { width: vue.width, height: vue.height },
          colorScheme: theme === 'clair' ? 'light' : 'dark',
          // Animations coupées : axe mesurait des textes en cours d'apparition, donc
          // à demi transparents, et les signalait à tort comme mal contrastés.
          reducedMotion: 'reduce',
          bypassCSP: true, // la CSP du site bloque cdnjs ; l'outil de mesure n'est pas le site
          storageState: etat,
        });
        await ctx.addInitScript((t) => {
          // L'écran d'introduction (logo animé) recouvre la page : on le marque comme vu.
          try { localStorage.setItem('westbourse-theme', t); sessionStorage.setItem('ws_splash_seen', '1'); } catch {}
        }, theme === 'clair' ? 'light' : 'dark');
        const page = await ctx.newPage();
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 160)));
        const rep = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1500);
        const statut = rep?.status();
        const finale = new URL(page.url());
        if (statut !== 200) r.bloquants.push(`statut HTTP ${statut}`);
        if (finale.pathname.replace(/\/$/, '') !== route.replace(/\/$/, '')) r.bloquants.push(`redirection vers ${finale.pathname}`);
        if (erreurs.length) r.bloquants.push(`erreurs JS : ${erreurs.slice(0, 3).join(' | ')}`);
        for (const sel of requis) {
          if ((await page.locator(sel).count()) === 0) r.bloquants.push(`sélecteur absent : ${sel}`);
        }
        const m = await page.evaluate(mesurer);
        if (m.debordement > 0) r.bloquants.push(`débordement horizontal de ${m.debordement}px`);
        if (m.petits.length) {
          r.bloquants.push(`${m.petits.length} texte(s) < 11px : ` + m.petits.slice(0, 10).map((p) => `${p.px}px <${p.tag}> "${p.texte}"`).join(' ; '));
        }
        await page.addScriptTag({ content: axeSource });
        const axe = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
        const graves = axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        for (const v of graves) r.bloquants.push(`axe ${v.impact} : ${v.id} (${v.nodes.length} nœud(s))`);
        // Le détail des nœuds sert à corriger : sans lui, le rapport ne dit pas quoi réparer.
        r.axe = graves.map((v) => ({
          id: v.id,
          noeuds: v.nodes.slice(0, 15).map((n) => ({
            cible: n.target.join(' ').slice(-80),
            html: n.html.slice(0, 120),
            mesure: n.any?.[0]?.data?.contrastRatio ? `${n.any[0].data.fgColor} sur ${n.any[0].data.bgColor} = ${n.any[0].data.contrastRatio}:1` : null,
          })),
        }));
        r.mesures = { sections: m.sections, h1: m.h1 };
        const base0 = ref?.resultats?.find((x) => x.cle === cle)?.mesures;
        if (ref && !base0) r.avertissements.push('absent du référentiel');
        if (base0) {
          if (JSON.stringify(base0.sections) !== JSON.stringify(m.sections)) {
            r.avertissements.push(`sections différentes du référentiel (${base0.sections.length} -> ${m.sections.length})`);
          }
          if (JSON.stringify(base0.h1) !== JSON.stringify(m.h1)) {
            r.avertissements.push(`h1 ${JSON.stringify(base0.h1)} -> ${JSON.stringify(m.h1)}`);
          }
        }
        await page.screenshot({ path: path.join(out, `${route.replace(/\W+/g, '_') || 'accueil'}__${theme}__${vue.nom}.png`), fullPage: true });
      } catch (e) {
        r.bloquants.push(`mesure impossible : ${String(e.message).split('\n')[0]}`);
      } finally {
        await ctx?.close();
      }
    }
  }
}
await browser.close();

const nbBloq = resultats.filter((r) => r.bloquants.length).length;
fs.writeFileSync(path.join(out, 'rapport.json'), JSON.stringify({ base, date: new Date().toISOString(), ok: nbBloq === 0, resultats }, null, 2));
for (const r of resultats) {
  console.log(`${r.bloquants.length ? 'ECHEC' : 'OK   '} ${r.cle}`);
  r.bloquants.forEach((b) => console.log(`   x ${b}`));
  r.avertissements.forEach((w) => console.log(`   ! ${w}`));
}
console.log(`\n${resultats.length} combinaisons, ${nbBloq} en échec. Rapport : ${path.join(out, 'rapport.json')}`);
process.exit(nbBloq ? 1 : 0);
