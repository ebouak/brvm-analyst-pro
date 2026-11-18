// Captures RÉELLES des vidéos « étudiants » (2026-11-18) : fenêtre mobile
// 390×844 @3x, thème clair, consentement « essentiels seulement », fenêtres
// d'invitation fermées. Une « loupe » est un RECADRAGE d'une de ces captures,
// jamais un écran redessiné.
//
//   node etudiants-captures.cjs public              pages publiques (production)
//   node etudiants-captures.cjs connecte            Academy + portefeuille virtuel (serveur LOCAL)
//   node etudiants-captures.cjs loupes              recadrages
//
// « connecte » exige : `next start -p 3100` dans frontend/, puis
// `node frontend/scripts/qa-sessions-locales.mjs` (comptes de test qa-e2e-*).
// Le portefeuille virtuel est ouvert sur le compte GRATUIT qa-e2e-debutant
// (preuve que la fonction est gratuite) et un ordre SNTS y est saisi. Ensuite,
// TOUJOURS : `node frontend/scripts/qa-sessions-locales.mjs --fermer`, qui
// révoque les sessions et supprime le portefeuille virtuel des comptes de test.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(require.resolve('playwright-core', { paths: [path.join(__dirname, '..', 'frontend')] }));

const OUT = path.join(__dirname, 'public', 'etudiants', 'ecrans');
const PROD = 'https://www.westbourse.com';
const LOCAL = 'http://localhost:3100';
const QA = path.join(os.tmpdir(), 'westbourse-qa');
fs.mkdirSync(OUT, { recursive: true });

async function contexte(navigateur, cookies) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', colorScheme: 'light' });
  if (cookies) await ctx.addCookies(JSON.parse(fs.readFileSync(path.join(QA, cookies), 'utf8')));
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('westbourse-theme', 'light');
      localStorage.setItem('ws_splash_seen', '1'); sessionStorage.setItem('ws_splash_seen', '1');
      localStorage.setItem('brvm-consent-v2', JSON.stringify({ version: 2, timestamp: new Date().toISOString(), granted: { essential: true, analytics: false, marketing: false } }));
    } catch (e) {}
  });
  return ctx;
}

async function fermerInvitations(p) {
  const bandeau = p.locator('[data-bandeau-cookies] button').first();
  if (await bandeau.count()) { try { await bandeau.click({ timeout: 1000 }); } catch {} }
  const plusTard = p.getByRole('button', { name: 'Plus tard' }).first();
  if (await plusTard.count() && await plusTard.isVisible()) { try { await plusTard.click({ timeout: 1500 }); } catch {} }
}

/** Ouvre `url`, puis pour chaque [nom, texte, décalage] défile jusqu'au texte et capture la fenêtre. */
async function vues(navigateur, url, liste, cookies) {
  const ctx = await contexte(navigateur, cookies);
  const p = await ctx.newPage();
  const r = await p.goto(url, { waitUntil: 'load', timeout: 180000 });
  if (!r || r.status() !== 200) throw new Error(`${url} : statut ${r && r.status()}`);
  await p.waitForTimeout(6000);
  for (const [nom, texte, decalage = 80] of liste) {
    const y = texte ? await p.getByText(texte, { exact: false }).first().evaluate((n) => n.getBoundingClientRect().top + window.scrollY) : 0;
    await p.evaluate((v) => window.scrollTo(0, v), Math.max(0, y - decalage));
    await p.waitForTimeout(1800);
    await fermerInvitations(p);
    await p.screenshot({ path: path.join(OUT, `${nom}.png`) });
    console.log('capture', nom);
  }
  return { ctx, p };
}

/** Loupe = la boîte RÉELLE d'un élément (de son ancêtre `anc` jusqu'au texte `fin`), en-têtes collants masqués. */
async function loupeElement(n, url, nom, texte, anc, fin) {
  const ctx = await contexte(n);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(5000);
  await fermerInvitations(p);
  const el = p.getByText(texte, { exact: false }).first().locator(`xpath=ancestor-or-self::${anc}[1]`);
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(1500);
  await fermerInvitations(p);
  // Masque seulement ce qui est collé à l'écran (barre du haut, barre du bas), pas les titres des cartes.
  await p.evaluate(() => {
    for (const n of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(n).position;
      if (pos === 'fixed' || pos === 'sticky') n.style.visibility = 'hidden';
    }
  });
  const b = await el.boundingBox();
  const bas = fin ? (await p.getByText(fin, { exact: false }).first().boundingBox()).y - 4 : b.y + b.height;
  await p.screenshot({ path: path.join(OUT, `${nom}.png`), clip: { x: b.x, y: b.y, width: b.width, height: bas - b.y } });
  console.log('loupe', nom);
  await ctx.close();
}

async function publiques(n) {
  await loupeElement(n, `${PROD}/pricing`, 'loupe-gratuit', 'Suivre la séance et l', 'section');
  await loupeElement(n, `${PROD}/societes/SNTS`, 'loupe-carnet', 'Quantités restées en carnet', 'section', 'Ordres non servis');
  await (await vues(n, `${PROD}/societes/SNTS`, [['snts'], ['snts-carnet', "Carnet d'ordres", 90]])).ctx.close();
  await (await vues(n, `${PROD}/pricing`, [['pricing', 'Suivre la séance et l', 120]])).ctx.close();
  await (await vues(n, `${PROD}/formations/academy`, [['ac-achat', 'Acheter la formation', 200]])).ctx.close();
}

async function connectees(n) {
  // Academy (compte Premium de test : toutes les leçons ouvertes).
  await (await vues(n, `${LOCAL}/formations/academy`, [['ac-hub'], ['ac-niveaux', 'Niveau 1 — Initiation', 420]], 'actif-cookies.json')).ctx.close();
  await (await vues(n, `${LOCAL}/formations/academy/academy-niveau-1-initiation?lecon=8`, [
    ['l8-simu', 'Capital de départ (FCFA)', 150], ['l8-simu-res', 'Sommes versées', 150],
    ['l8-reel', 'Sur la BRVM : ce que rapportent', 90], ['l8-quiz', 'Quiz · 5 questions', 90],
  ], 'actif-cookies.json')).ctx.close();

  // Portefeuille virtuel : compte GRATUIT de test.
  const { ctx, p } = await vues(n, `${LOCAL}/premium/paper-trading`, [['pt-capital']], 'debutant-cookies.json');
  await p.getByRole('button', { name: '10M FCFA' }).first().click();
  await p.waitForTimeout(5000);
  await p.getByRole('button', { name: 'Nouvel ordre' }).first().click();
  await p.waitForTimeout(2000);
  const choix = p.getByLabel('Valeur BRVM').first();
  await choix.selectOption({ value: 'SNTS' });
  await p.getByLabel(/Quantité/i).first().fill('10');
  await p.waitForTimeout(1200);
  await choix.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => window.scrollBy(0, -170));
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, 'pt-ordre.png') });
  await p.getByRole('button', { name: /Simuler l’ordre d’achat/ }).first().click();
  await p.waitForTimeout(4000);
  await ctx.close();
  await (await vues(n, `${LOCAL}/premium/paper-trading`, [['pt-suivi', 'Valeur du portefeuille', 90], ['pt-ordres', 'Ordres simulés', 90]], 'debutant-cookies.json')).ctx.close();
}

/** Recadrages (pixels de la capture @3x), relevés à l'œil sur les captures du 2026-11-18 :
 *  à revérifier si les captures sont refaites. */
function loupes() {
  const rec = (src, dst, w, h, x, y) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(OUT, `${src}.png`), '-vf', `crop=${w}:${h}:${x}:${y}`, path.join(OUT, `${dst}.png`)]);
  rec('pt-ordres', 'loupe-ordre', 1076, 580, 47, 210);
  rec('l8-simu-res', 'loupe-simu', 960, 730, 105, 1440);
  rec('l8-reel', 'loupe-reel', 1075, 540, 95, 1340);
  rec('l8-quiz', 'loupe-quiz', 980, 1150, 95, 200);
  rec('ac-niveaux', 'loupe-examen', 1080, 480, 45, 1225);
  rec('ac-achat', 'loupe-prix', 960, 460, 100, 1105);
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'loupes') return loupes();
  const n = await chromium.launch();
  try {
    if (mode === 'public') await publiques(n);
    else if (mode === 'connecte') await connectees(n);
    else throw new Error('mode : public | connecte | loupes');
  } finally {
    await n.close();
  }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
