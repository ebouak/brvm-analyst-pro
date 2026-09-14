/**
 * dossiers.mjs — imprime le dossier valeur de chaque action cotée en PDF A4 et
 * le range dans le bucket privé `dossiers`.
 *
 * POURQUOI ICI. Ce paquet a déjà Playwright + Chromium (la vidéo de séance) ;
 * la page /rapports/dossier/[code] a déjà sa feuille d'impression. Imprimer la
 * page VIVANTE garantit une seule source de mise en page — un second gabarit
 * PDF aurait dérivé du premier en quelques semaines.
 *
 * ACCÈS. La page est derrière le mur de connexion. Le worker n'a pas de
 * session : il présente DOSSIER_RENDER_SECRET dans l'en-tête `x-dossier-render`,
 * que le middleware accepte pour ce seul préfixe. Jamais dans l'URL.
 *
 * CE QUI EST PRODUIT, PAR CODE :  <CODE>/<date>.pdf  (historique)
 *                                  <CODE>/dernier.pdf (ce que sert /api/dossier/[code]/pdf)
 *
 * VERROU. Un PDF n'est rangé que si la page a rendu ses sept feuilles (`.dv-page`)
 * et si le fichier fait plus de 30 ko. Une page d'erreur imprimée fait une
 * feuille et quelques ko ; la ranger sous « dernier.pdf » livrerait une erreur
 * à un client. Un code en échec n'arrête pas le lot ; il est listé à la fin et
 * fait échouer le processus (code 1) pour que le workflow le signale.
 *
 * Usage :  node dossiers.mjs            → toutes les valeurs de la dernière séance
 *          node dossiers.mjs NEIC SGBC  → ces codes seulement
 *          DOSSIER_DRY=1 node dossiers.mjs NEIC → imprime dans out/ sans rien ranger
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const OUT = `${ICI}/out/dossiers`;

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
const ANON = lire('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SECRET = lire('DOSSIER_RENDER_SECRET');
const SITE = (lire('DOSSIER_SITE_URL') || 'https://www.westbourse.com').replace(/\/$/, '');
const BUCKET = 'dossiers';
const DRY = lire('DOSSIER_DRY') === '1';
const FEUILLES_ATTENDUES = 7;
const OCTETS_MIN = 30_000;

const manquants = [['SUPABASE_URL', URL_SB], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE], ['DOSSIER_RENDER_SECRET', SECRET]]
  .filter(([k, v]) => !v && !(DRY && k === 'SUPABASE_SERVICE_ROLE_KEY')).map(([k]) => k);
if (manquants.length) {
  console.error(`Dossiers : refus — variables absentes : ${manquants.join(', ')}`);
  process.exit(2);
}
if (SECRET.length < 32) {
  console.error('Dossiers : refus — DOSSIER_RENDER_SECRET fait moins de 32 caractères (le middleware le refuserait aussi).');
  process.exit(2);
}

/* ── Codes à traiter : la dernière séance, comme la route de polissage ───── */
async function codesDerniereSeance() {
  const cle = ANON || SERVICE;
  const h = { apikey: cle, Authorization: `Bearer ${cle}` };
  const r1 = await fetch(`${URL_SB}/rest/v1/brvm_actions_daily?select=date_marche&order=date_marche.desc&limit=1`, { headers: h });
  const [derniere] = await r1.json();
  if (!derniere?.date_marche) return { date: null, codes: [] };
  const r2 = await fetch(`${URL_SB}/rest/v1/brvm_actions_daily?select=code&date_marche=eq.${derniere.date_marche}&order=code`, { headers: h });
  const rows = await r2.json();
  return { date: derniere.date_marche, codes: [...new Set(rows.map((r) => r.code))] };
}

/* ── Rangement ──────────────────────────────────────────────────────────── */
async function ranger(chemin, octets) {
  const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${chemin}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: octets,
  });
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${(await r.text()).slice(0, 200)}`);
}

/* ── Impression ─────────────────────────────────────────────────────────── */
async function imprimer(page, code) {
  const url = `${SITE}/rapports/dossier/${code}`;
  const rep = await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  const statut = rep?.status() ?? 0;
  const finale = page.url();
  if (statut !== 200 || finale.includes('/login')) {
    throw new Error(`HTTP ${statut}, url finale ${finale} — le secret de rendu est-il posé sur Vercel ?`);
  }
  const feuilles = await page.locator('.dv-page').count();
  if (feuilles !== FEUILLES_ATTENDUES) {
    throw new Error(`${feuilles} feuille(s) rendue(s) au lieu de ${FEUILLES_ATTENDUES}`);
  }
  /* À l'impression, chaque feuille a une hauteur fixe et `overflow: hidden`.
     Un contenu qui déborde serait ROGNÉ en silence — un rapport client avec une
     ligne coupée. On le mesure ici, sous média print, et on refuse. */
  await page.emulateMedia({ media: 'print' });
  const debords = await page.locator('.dv-page').evaluateAll((els) =>
    els.map((e, i) => (e.scrollHeight > e.clientHeight + 1 ? `feuille ${i + 1} (+${e.scrollHeight - e.clientHeight} px)` : null)).filter(Boolean),
  );
  if (debords.length) {
    throw new Error(`contenu qui déborde à l'impression : ${debords.join(', ')} — non rangé`);
  }
  const octets = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  if (octets.length < OCTETS_MIN) {
    throw new Error(`PDF de ${octets.length} octets — trop petit pour sept feuilles, non rangé`);
  }
  return octets;
}

/* ── Lot ─────────────────────────────────────────────────────────────────── */
const demandes = process.argv.slice(2).map((c) => c.toUpperCase());
const { date, codes } = demandes.length ? { date: null, codes: demandes } : await codesDerniereSeance();
if (codes.length === 0) {
  console.error('Dossiers : aucun code à traiter (base vide ?)');
  process.exit(1);
}
const jour = new Date().toISOString().slice(0, 10);
console.log(`Dossiers : ${codes.length} valeur(s)${date ? ` (séance du ${date})` : ''} → ${BUCKET}/<CODE>/${jour}.pdf`);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const contexte = await browser.newContext({
  extraHTTPHeaders: { 'x-dossier-render': SECRET },
  locale: 'fr-FR',
});
/* Le splash d'intro (components/brand/SplashScreen) s'affiche une seconde au
   premier chargement d'une session, en `fixed` par-dessus tout. Un contexte
   Playwright est toujours une session neuve : sans ce drapeau — le sien —
   la première impression sortait avec un voile sombre sur chaque page. */
await contexte.addInitScript(() => {
  try { sessionStorage.setItem('ws_splash_seen', '1'); } catch {}
});
const page = await contexte.newPage();

const echecs = [];
let ranges = 0;
for (const code of codes) {
  try {
    const octets = await imprimer(page, code);
    writeFileSync(`${OUT}/${code}-${jour}.pdf`, octets);
    if (!DRY) {
      await ranger(`${code}/${jour}.pdf`, octets);
      await ranger(`${code}/dernier.pdf`, octets);
    }
    ranges += 1;
    console.log(`  ${code}  ${(octets.length / 1024).toFixed(0)} ko  ${DRY ? 'imprimé (dry)' : 'rangé'}`);
  } catch (e) {
    echecs.push([code, String(e?.message ?? e)]);
    console.log(`  ${code}  ÉCHEC — ${String(e?.message ?? e)}`);
  }
}
await browser.close();

console.log(`Dossiers : ${ranges} rangé(s), ${echecs.length} échec(s).`);
if (echecs.length) {
  for (const [c, m] of echecs) console.error(`  ${c}: ${m}`);
  process.exit(1);
}
