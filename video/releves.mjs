/**
 * releves.mjs — imprime le relevé mensuel de chaque compte en PDF A4 et le
 * range dans le bucket PRIVÉ `releves` (<user_id>/<AAAA-MM>.pdf).
 *
 * DONNÉES PRIVÉES. Un relevé contient un portefeuille. Différences voulues avec
 * dossiers.mjs (qui n'imprime que du marché, avec un secret partagé) :
 *  - AUCUN secret partagé : pour CHAQUE relevé, un jeton aléatoire de 32 octets
 *    est tiré ici, son SHA-256 et une expiration à +5 minutes sont écrits dans
 *    `monthly_reports` (service_role), puis le jeton est présenté dans l'en-tête
 *    `x-releve-render` de la SEULE requête du document. La page le consomme dès
 *    la lecture (usage unique) ;
 *  - le jeton n'est jamais dans une URL, jamais journalisé, et il est effacé en
 *    base quoi qu'il arrive (bloc finally) : un échec ne laisse aucun jeton valide ;
 *  - rien du contenu n'est affiché : seuls l'identifiant du relevé, la taille
 *    et le nombre de feuilles sortent dans les journaux.
 *
 * VERROU. Un PDF n'est rangé que si la page a rendu toutes ses feuilles (le
 * nombre attendu est annoncé par la page, `data-total-feuilles`), si aucune
 * feuille ne déborde (hauteur fixe + overflow caché = rognage silencieux) et si
 * le fichier fait plus de 15 ko. Un relevé en échec n'arrête pas le lot ; il
 * est listé à la fin et fait échouer le processus (code 1).
 *
 * Ne traite que les relevés de version 2 SANS `report_url` : relancer ne
 * réimprime rien qui soit déjà prêt, et un relevé dont le contenu a changé a vu
 * son `report_url` remis à null par la génération.
 *
 * Usage :  node releves.mjs               → mois précédent
 *          node releves.mjs 2026-10       → ce mois
 *          RELEVE_DRY=1 node releves.mjs  → liste ce qui serait imprimé, ne fait RIEN d'autre
 */
import { chromium } from 'playwright';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from './supabaseEntetes.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');

const envLocal = [`${RACINE}/video/.env.local`, `${RACINE}/frontend/.env.local`]
  .filter((f) => existsSync(f))
  .map((f) => readFileSync(f, 'utf8').replace(/^﻿/, ''))
  .join('\n');
const lire = (...cles) => {
  for (const k of cles) {
    if (process.env[k]) return process.env[k].trim();
    const t = envLocal.match(new RegExp('^' + k + '=(.*)$', 'm'));
    if (t) return t[1].trim().replace(/^"|"$/g, '');
  }
  return '';
};

const URL_SB = lire('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const SERVICE = lire('SUPABASE_SERVICE_ROLE_KEY');
const SITE = (lire('RELEVE_SITE_URL', 'DOSSIER_SITE_URL') || 'https://www.westbourse.com').replace(/\/$/, '');
const BUCKET = 'releves';
const DRY = lire('RELEVE_DRY') === '1';
const OCTETS_MIN = 15_000;
const VALIDITE_JETON_MS = 5 * 60 * 1000;
const EN_TETE = 'x-releve-render';

const manquants = [['SUPABASE_URL', URL_SB], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE]].filter(([, v]) => !v).map(([k]) => k);
if (manquants.length) {
  console.error(`Relevés : refus — variables absentes : ${manquants.join(', ')}`);
  process.exit(2);
}

/* ── Mois visé : argument, sinon mois précédent (UTC) ────────────────────── */
function moisPrecedent() {
  const d = new Date();
  const p = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return p.toISOString().slice(0, 7);
}
const MOIS = process.argv[2] || moisPrecedent();
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(MOIS)) {
  console.error(`Relevés : mois invalide « ${MOIS} » (attendu AAAA-MM)`);
  process.exit(2);
}

const H = entetesSupabase(SERVICE);
const rest = (chemin, init = {}) => fetch(`${URL_SB}/rest/v1/${chemin}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });

/* ── Relevés à imprimer ──────────────────────────────────────────────────── */
async function relevesAImprimer() {
  const r = await rest(`monthly_reports?select=id,user_id&month=eq.${MOIS}&report_url=is.null&report_json->>version=eq.2&order=id`);
  if (!r.ok) throw new Error(`lecture de monthly_reports : ${r.status}`);
  return r.json();
}

/* ── Jeton à usage unique ────────────────────────────────────────────────── */
async function poserJeton(id) {
  const jeton = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(jeton).digest('hex');
  const expire = new Date(Date.now() + VALIDITE_JETON_MS).toISOString();
  const r = await rest(`monthly_reports?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ rendu_jeton_hash: hash, rendu_jeton_expire: expire }),
  });
  if (!r.ok) throw new Error(`pose du jeton : ${r.status}`);
  return jeton;
}
async function effacerJeton(id) {
  try {
    await rest(`monthly_reports?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ rendu_jeton_hash: null, rendu_jeton_expire: null }),
    });
  } catch {
    /* L'expiration à 5 minutes borne de toute façon la durée de vie du jeton. */
  }
}

/* ── Rangement ───────────────────────────────────────────────────────────── */
async function ranger(chemin, octets) {
  const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${chemin}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: octets,
  });
  if (!r.ok) throw new Error(`rangement → ${r.status}`);
}
async function noterChemin(id, chemin) {
  const r = await rest(`monthly_reports?id=eq.${id}&report_url=is.null`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ report_url: chemin }),
  });
  if (!r.ok) throw new Error(`écriture de report_url : ${r.status}`);
}

/* ── Impression d'un relevé ──────────────────────────────────────────────── */
async function imprimer(browser, id, jeton) {
  const contexte = await browser.newContext({ locale: 'fr-FR' });
  /* Splash d'intro : voir dossiers.mjs (même drapeau, même raison). */
  await contexte.addInitScript(() => {
    try { sessionStorage.setItem('ws_splash_seen', '1'); } catch {}
  });
  const url = `${SITE}/rapports/releve/${id}`;
  /* L'en-tête n'est posé que sur la requête DU DOCUMENT, pas sur les feuilles
     de style, polices et images : le jeton ne circule pas plus qu'il ne faut. */
  await contexte.route(url, (route) => route.continue({ headers: { ...route.request().headers(), [EN_TETE]: jeton } }));
  try {
    const page = await contexte.newPage();
    const rep = await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    const statut = rep?.status() ?? 0;
    if (statut !== 200 || page.url().includes('/login')) {
      throw new Error(`HTTP ${statut} (jeton refusé, expiré, ou relevé introuvable)`);
    }
    if ((await page.locator('.rl-erreur').count()) > 0) throw new Error('page en erreur (format de relevé non reconnu)');

    const attendues = Number(await page.locator('[data-total-feuilles]').first().getAttribute('data-total-feuilles').catch(() => null));
    const feuilles = await page.locator('[data-feuille]').count();
    if (!(attendues > 0) || feuilles !== attendues) {
      throw new Error(`${feuilles} feuille(s) rendue(s) pour ${attendues || '?'} attendue(s)`);
    }

    /* Hauteur fixe + overflow caché à l'impression : un contenu qui déborde
       serait ROGNÉ en silence. On le mesure sous média print et on refuse. */
    await page.emulateMedia({ media: 'print' });
    const debords = await page.locator('[data-feuille]').evaluateAll((els) =>
      els.map((e, i) => (e.scrollHeight > e.clientHeight + 1 ? `feuille ${i + 1} (+${e.scrollHeight - e.clientHeight} px)` : null)).filter(Boolean),
    );
    if (debords.length) throw new Error(`contenu qui déborde à l'impression : ${debords.join(', ')}`);

    const octets = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    if (octets.length < OCTETS_MIN) throw new Error(`PDF de ${octets.length} octets, trop petit pour un relevé complet`);
    return { octets, feuilles };
  } finally {
    await contexte.close();
  }
}

/* ── Lot ─────────────────────────────────────────────────────────────────── */
const releves = await relevesAImprimer();
console.log(`Relevés ${MOIS} : ${releves.length} à imprimer → ${BUCKET}/<compte>/${MOIS}.pdf${DRY ? ' (à blanc : rien ne sera fait)' : ''}`);
if (DRY || releves.length === 0) process.exit(0);

const browser = await chromium.launch();
const echecs = [];
let ranges = 0;
for (const { id, user_id: userId } of releves) {
  const court = id.slice(0, 8);
  let jeton = null;
  try {
    jeton = await poserJeton(id);
    const { octets, feuilles } = await imprimer(browser, id, jeton);
    const chemin = `${userId}/${MOIS}.pdf`;
    await ranger(chemin, octets);
    await noterChemin(id, chemin);
    ranges += 1;
    console.log(`  ${court}…  ${feuilles} feuille(s)  ${(octets.length / 1024).toFixed(0)} ko  rangé`);
  } catch (e) {
    echecs.push([court, String(e?.message ?? e)]);
    console.log(`  ${court}…  ÉCHEC — ${String(e?.message ?? e)}`);
  } finally {
    // Quoi qu'il arrive, aucun jeton ne reste valide en base.
    if (jeton) await effacerJeton(id);
  }
}
await browser.close();

console.log(`Relevés : ${ranges} rangé(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
