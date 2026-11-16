#!/usr/bin/env node
/**
 * Test « téléphone lent, réseau lent » (règle 31 de l'audit de performance).
 *
 * Ouvre chaque page dans Chromium en conditions bridées — viewport mobile,
 * processeur ralenti ×4, « 4G lente » (150 ms de latence, 1,6 Mb/s) — cache
 * vide, plusieurs passages, et rapporte la MÉDIANE de :
 *   - FCP : premier contenu affiché (squelette compris) ;
 *   - LCP : plus grand élément affiché ;
 *   - JS  : octets de JavaScript téléchargés (compressés) ;
 * puis mesure la réactivité d'une saisie dans le champ de recherche de
 * /actions (pire durée d'événement, proxy de l'INP).
 *
 * Pourquoi ces réglages : ce sont ceux des mesures consignées dans le dépôt
 * (Pixel 7, 4G lente, CPU ×4 — voir app/dashboard/page.tsx). Les visiteurs
 * d'Abidjan, Dakar ou Ouagadougou sur mobile ressemblent davantage à ce profil
 * qu'à un ordinateur de bureau sur fibre.
 *
 * Usage (application déjà démarrée) :
 *   npm run build && npm run start          # dans un autre terminal
 *   npm run perf:mobile                     # http://localhost:3000, 3 passages
 *   PERF_BASE=https://www.westbourse.com PERF_PASSAGES=5 npm run perf:mobile
 *   PERF_PAGES=/,/actions,/societes npm run perf:mobile
 *   PERF_LCP_MAX=4000 npm run perf:mobile   # code 1 si une médiane dépasse
 *
 * Pages connectées : PERF_COOKIE="<valeur du cookie sb-…-auth-token>" et
 * PERF_COOKIE_NOM="sb-<ref>-auth-token". Sans cookie, les pages protégées
 * mesurent la redirection vers /login, ce qui n'a pas de sens : elles sont
 * alors sautées.
 *
 * Lecture seule : ce script ne clique sur rien qui écrive.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.PERF_BASE ?? 'http://localhost:3000';
const PASSAGES = Number(process.env.PERF_PASSAGES ?? 3);
const PAGES = (process.env.PERF_PAGES ?? '/,/login,/actions,/actions/SNTS,/societes,/dashboard').split(',').map((p) => p.trim()).filter(Boolean);
const LCP_MAX = process.env.PERF_LCP_MAX ? Number(process.env.PERF_LCP_MAX) : null;
const COOKIE = process.env.PERF_COOKIE ?? null;
const COOKIE_NOM = process.env.PERF_COOKIE_NOM ?? null;

const RESEAU = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const CPU = 4;
const mediane = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const navigateur = await chromium.launch(process.env.PERF_CHROME ? { executablePath: process.env.PERF_CHROME } : {});

async function contexte() {
  const ctx = await navigateur.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  if (COOKIE && COOKIE_NOM) await ctx.addCookies([{ name: COOKIE_NOM, value: COOKIE, url: BASE }]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RESEAU);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  return { ctx, page, cdp };
}

const lignes = [];
let depassement = false;

for (const chemin of PAGES) {
  const fcp = [], lcp = [], js = [];
  let redirige = false;
  for (let i = 0; i < PASSAGES; i++) {
    const { ctx, page, cdp } = await contexte();
    let octetsJs = 0;
    const typesJs = new Set();
    cdp.on('Network.responseReceived', (e) => { if (e.type === 'Script') typesJs.add(e.requestId); });
    cdp.on('Network.loadingFinished', (e) => { if (typesJs.has(e.requestId)) octetsJs += e.encodedDataLength; });
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const rep = await page.goto(BASE + chemin, { waitUntil: 'load', timeout: 120_000 });
    if (new URL(page.url()).pathname !== chemin.split('?')[0] || (rep && rep.status() >= 300 && rep.status() < 400)) redirige = true;
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => ({ lcp: window.__lcp, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0 }));
    fcp.push(m.fcp); lcp.push(m.lcp); js.push(octetsJs);
    await ctx.close();
  }
  if (redirige) { lignes.push({ page: chemin, note: 'redirigée (connexion requise ?) — sautée' }); continue; }
  const l = { page: chemin, fcpMs: Math.round(mediane(fcp)), lcpMs: Math.round(mediane(lcp)), jsKo: Math.round(mediane(js) / 1024) };
  if (LCP_MAX != null && l.lcpMs > LCP_MAX) { l.note = `LCP > ${LCP_MAX} ms`; depassement = true; }
  lignes.push(l);
}

// Réactivité : saisie dans la recherche de /actions, processeur ralenti ×4.
let reactivite = null;
{
  const ctx = await navigateur.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => {
    window.__evts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__evts.push(e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  });
  await page.goto(BASE + '/actions', { waitUntil: 'networkidle', timeout: 120_000 });
  const champ = page.locator('input[placeholder="Code ou nom"]').first();
  if (await champ.count()) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.evaluate(() => { window.__evts = []; });
    await champ.click();
    await page.keyboard.type('sonatel', { delay: 120 });
    await page.waitForTimeout(800);
    const d = await page.evaluate(() => window.__evts);
    reactivite = { page: '/actions (saisie)', pireEvenementMs: Math.round(Math.max(0, ...d)), seuilINP: 200 };
  }
  await ctx.close();
}

await navigateur.close();
console.log(`\nConditions : mobile 412×915, CPU ×${CPU}, 4G lente (150 ms, 1,6 Mb/s), médiane de ${PASSAGES} passage(s), ${BASE}\n`);
console.table(lignes);
if (reactivite) console.table([reactivite]);
if (depassement) { console.error(`\nAu moins une page dépasse le budget LCP de ${LCP_MAX} ms.`); process.exit(1); }
