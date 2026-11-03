#!/usr/bin/env node
// Publication des résultats e2e vers /admin/qualite.
//
//   node scripts/qa-publier.mjs debut   → déclare l'exécution (« en cours »)
//   node scripts/qa-publier.mjs fin     → envoie le rapport, puis les pièces jointes
//
// Lancé par .github/workflows/e2e.yml, l'étape `fin` en `if: always()` : un
// échec des tests ou du build est PUBLIÉ, jamais avalé. Le serveur décide du
// statut (erreur d'infrastructure, interrompu, terminé) ; ce script ne fait que
// transporter.
//
// Ce script n'a PAS la clé service_role : il présente QA_INGEST_SECRET, qui ne
// permet que d'écrire des résultats. Les fichiers partent vers le bucket privé
// par des URL de dépôt signées, une par fichier. Aucune dépendance ; une seule
// commande externe (`zip`), aux arguments fixes.
//
// Variables : QA_INGEST_URL (ex. https://www.westbourse.com), QA_INGEST_SECRET,
// BUILD_OUTCOME, TESTS_OUTCOME (issues des étapes GitHub), QA_ENVIRONNEMENT
// (défaut ci), NEXT_PUBLIC_SUPABASE_ANON_KEY (clé PUBLIQUE, pour le dépôt
// signé), et les variables GITHUB_* standard.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
const base = (process.env.QA_INGEST_URL ?? '').replace(/\/+$/, '');
const secret = process.env.QA_INGEST_SECRET ?? '';
const RACINE = process.cwd();
const RAPPORT_JSON = path.join(RACINE, 'test-results', 'rapport.json');
const DOSSIER_RESULTATS = path.join(RACINE, 'test-results');
const DOSSIER_HTML = path.join(RACINE, 'playwright-report');
const ZIP_HTML = path.join(RACINE, 'playwright-report.zip');
const TAILLE_MAX = 50 * 1024 * 1024;

const avertir = (m) => console.log(`::warning title=Qualité & Tests::${m}`);
const erreur = (m) => console.log(`::error title=Qualité & Tests::${m}`);

if (!['debut', 'fin'].includes(mode)) {
  console.error('Usage : node scripts/qa-publier.mjs debut|fin');
  process.exit(2);
}
// Un fork n'a pas les secrets : on le dit, sans faire échouer sa CI.
if (!base || !secret) {
  avertir('QA_INGEST_URL ou QA_INGEST_SECRET absent : résultats NON publiés dans /admin/qualite.');
  process.exit(0);
}
if (!/^https:\/\//.test(base) && !/^http:\/\/localhost(:\d+)?$/.test(base)) {
  erreur('QA_INGEST_URL doit être en https.');
  process.exit(1);
}

const meta = {
  ci_run_id: process.env.GITHUB_RUN_ID,
  ci_tentative: Number(process.env.GITHUB_RUN_ATTEMPT ?? '1'),
  ci_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  workflow: process.env.GITHUB_WORKFLOW ?? null,
  branche: process.env.GITHUB_REF_NAME ?? null,
  commit_sha: process.env.GITHUB_SHA,
  environnement: process.env.QA_ENVIRONNEMENT ?? 'ci',
  base_url: process.env.QA_BASE_URL ?? 'http://localhost:3000',
};

/** POST JSON avec trois essais sur panne réseau ou 5xx (les routes sont idempotentes). */
async function poster(chemin, corps) {
  let derniere;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const r = await fetch(`${base}${chemin}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`, 'user-agent': 'westbourse-qa-ci/1.0' },
        body: JSON.stringify(corps),
      });
      const texte = await r.text();
      let json = null;
      try { json = JSON.parse(texte); } catch { /* corps non JSON */ }
      if (r.status < 500) return { status: r.status, json };
      derniere = `HTTP ${r.status}`;
    } catch (e) {
      derniere = e instanceof Error ? e.message : String(e);
    }
    await new Promise((ok) => setTimeout(ok, essai * 3000));
  }
  return { status: 0, json: null, erreur: derniere };
}

/** Retire ce qui ne doit jamais quitter le runner : sorties console et corps des pièces jointes. */
function alleger(noeud) {
  if (Array.isArray(noeud)) return noeud.forEach(alleger);
  if (!noeud || typeof noeud !== 'object') return;
  delete noeud.stdout;
  delete noeud.stderr;
  if (Array.isArray(noeud.attachments)) for (const a of noeud.attachments) delete a.body;
  for (const v of Object.values(noeud)) alleger(v);
}

function lireRapport() {
  if (!fs.existsSync(RAPPORT_JSON)) return null;
  try {
    const r = JSON.parse(fs.readFileSync(RAPPORT_JSON, 'utf8'));
    alleger(r);
    return r;
  } catch {
    return null;
  }
}

function zipperHtml() {
  if (!fs.existsSync(DOSSIER_HTML)) return null;
  try {
    fs.rmSync(ZIP_HTML, { force: true });
    execFileSync('zip', ['-qr', ZIP_HTML, 'playwright-report'], { cwd: RACINE, stdio: 'ignore' });
    const taille = fs.statSync(ZIP_HTML).size;
    if (taille === 0 || taille > TAILLE_MAX) return null;
    return { taille };
  } catch {
    avertir('Rapport HTML non zippé : il sera indiqué « indisponible ».');
    return null;
  }
}

/** Le serveur dit quel fichier envoyer ; on ne lit QUE sous test-results/ ou le zip du rapport. */
function fichierAutorise(source) {
  if (source === 'playwright-report.zip') return ZIP_HTML;
  const abs = path.resolve(source);
  return abs.startsWith(DOSSIER_RESULTATS + path.sep) ? abs : null;
}

const TYPES = { '.png': 'image/png', '.zip': 'application/zip', '.webm': 'video/webm' };

async function deposer(depot) {
  const fichier = fichierAutorise(depot.source);
  if (!fichier || !fs.existsSync(fichier)) return false;
  const taille = fs.statSync(fichier).size;
  if (taille > TAILLE_MAX) return false;
  const entetes = { 'content-type': TYPES[path.extname(fichier)] ?? 'application/octet-stream', 'x-upsert': 'true' };
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (cle) entetes.apikey = cle; // clé PUBLIQUE ; le droit d'écrire vient du jeton signé de l'URL
  try {
    const r = await fetch(depot.url, { method: 'PUT', headers: entetes, body: fs.readFileSync(fichier) });
    return r.ok;
  } catch {
    return false;
  }
}

if (mode === 'debut') {
  const r = await poster('/api/qa/ingest/debut', { meta });
  if (r.status !== 200) {
    // Pas bloquant : `fin` crée l'exécution si `debut` n'est pas passé.
    avertir(`Début non déclaré (${r.status || r.erreur}).`);
  }
} else {
  // Code de sortie posé, jamais process.exit() juste après un fetch : sous
  // Windows, Node plante alors (UV_HANDLE_CLOSING, code 127).
  process.exitCode = await publierFin();
}

// ── fin ──────────────────────────────────────────────────────────────────
async function publierFin() {
  const issues = { build: process.env.BUILD_OUTCOME || 'skipped', tests: process.env.TESTS_OUTCOME || 'skipped' };
  const rapport = lireRapport();
  const rapportHtml = zipperHtml();
  const r = await poster('/api/qa/ingest/fin', { meta, issues, rapport, rapportHtml });

  if (r.status !== 200 || !r.json) {
    erreur(`Publication refusée (${r.status || r.erreur}${r.json?.error ? ` : ${r.json.error}` : ''}). L'exécution apparaîtra « incomplète ».`);
    return 1;
  }

  const { statut, nb_resultats, depots = [], depots_en_echec = 0, purge, deja_importe } = r.json;
  console.log(`Qualité & Tests : ${deja_importe ? 'déjà importée' : 'importée'} — statut ${statut}, ${nb_resultats} scénario(s).`);

  const envoyes = [];
  for (const d of depots) if (await deposer(d)) envoyes.push(d.chemin);
  const ratés = depots.length - envoyes.length + depots_en_echec;

  let confirmes = 0;
  for (let i = 0; i < envoyes.length; i += 100) {
    const c = await poster('/api/qa/ingest/artefacts/confirmer', { meta: { ci_run_id: meta.ci_run_id, ci_tentative: meta.ci_tentative }, chemins: envoyes.slice(i, i + 100) });
    if (c.status === 200) confirmes += c.json?.confirmes ?? 0;
  }
  console.log(`Pièces jointes : ${confirmes} confirmée(s) sur ${depots.length + depots_en_echec}.`);
  if (ratés > 0) avertir(`${ratés} pièce(s) jointe(s) non envoyée(s) : elles apparaîtront « indisponibles ».`);
  if (purge === 'echec') avertir('Purge des anciennes pièces jointes en échec (à surveiller).');
  return 0;
}
