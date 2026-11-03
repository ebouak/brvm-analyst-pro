#!/usr/bin/env node
// Sessions de test LOCALES pour les e2e qui exigent un compte connecté
// (screener Premium, KPI animés, dashboard actif/débutant).
//
//   npm run e2e:connecte              → prépare les comptes, ouvre les sessions,
//                                       lance TOUTE la suite Playwright avec elles
//   npm run e2e:connecte -- e2e/screener.spec.ts   → idem, fichiers choisis
//   node scripts/qa-sessions-locales.mjs --fermer  → révoque les sessions de test
//
// POURQUOI LOCAL : la connexion exige un jeton anti-robot jusque dans Supabase
// (`captcha_failed` sans lui). Ouvrir une session à la CI demanderait une porte
// en production ; on a choisi de ne pas en créer (2026-11-03). Ce script tourne
// sur le poste de l'exploitant, avec la clé serveur DÉJÀ présente dans
// .env.local — jamais affichée, jamais envoyée ailleurs qu'à Supabase.
//
// Comptes (idempotent, créés au premier passage) :
//   qa-e2e-actif@westbourse.com     Premium, 2 positions (profil « actif »)
//   qa-e2e-debutant@westbourse.com  gratuit, aucune position (profil « débutant »)
// Tous deux portent app_metadata.qa_e2e = true (posable par le seul serveur),
// sont exclus du CRM (crm_oppositions) et ne doivent JAMAIS avoir de rôle admin.
// Une adresse de test existant SANS la marque n'est pas à nous : on n'y touche pas.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(os.tmpdir(), 'westbourse-qa');
const COMPTES = { actif: 'qa-e2e-actif@westbourse.com', debutant: 'qa-e2e-debutant@westbourse.com' };
const POSITIONS_ACTIF = [{ code: 'SNTS', quantite: 10 }, { code: 'SGBC', quantite: 20 }];
// Une clé sb_secret_ est refusée si le User-Agent ressemble à un navigateur (CLAUDE.md).
const ENTETES = { 'User-Agent': 'westbourse-qa-local/1.0' };

function lireEnvLocal() {
  const fichier = path.join(RACINE, '.env.local');
  if (!fs.existsSync(fichier)) throw new Error('frontend/.env.local introuvable.');
  const env = {};
  for (const ligne of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = lireEnvLocal();
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_PUBLIQUE = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLE_SERVEUR = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CLE_PUBLIQUE || !CLE_SERVEUR) {
  console.error('Il manque NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.');
  process.exit(1);
}

const admin = createClient(URL_SB, CLE_SERVEUR, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: ENTETES },
});

const verifier = (quoi, error) => {
  if (error) throw new Error(`${quoi} : ${error.message}`);
};

async function chercherCompte(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    verifier('liste des comptes', error);
    const trouve = data.users.find((u) => u.email?.toLowerCase() === email);
    if (trouve) return trouve;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function assurerCompte(email) {
  let u = await chercherCompte(email);
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { qa_e2e: true } });
    verifier(`création de ${email}`, error);
    u = data.user;
    console.log(`Compte de test créé : ${email}`);
  } else if (u.app_metadata?.qa_e2e !== true) {
    throw new Error(`${email} existe SANS la marque qa_e2e : ce n'est pas un compte de test, refus d'y toucher.`);
  }
  const { count, error } = await admin.from('admin_user_roles').select('role_id', { count: 'exact', head: true }).eq('user_id', u.id);
  verifier('rôles admin', error);
  if (count) throw new Error(`${email} porte un rôle d'administration : refus.`);
  // Jamais de relance commerciale vers un compte de test.
  const { error: eOpp } = await admin.from('crm_oppositions').upsert({ email_norm: email, source: 'admin' }, { onConflict: 'email_norm', ignoreDuplicates: true });
  verifier('exclusion CRM', eOpp);
  // Même geste que le bouton « Passer » de la fenêtre « Quel est votre profil ? »
  // (OnboardingModal) : sans lui, cette fenêtre recouvre chaque page d'un compte
  // neuf et intercepte les clics des tests (constaté au premier passage).
  const { error: eOnb } = await admin.from('profiles').update({ onboarding_done: true }).eq('id', u.id);
  verifier('onboarding du compte de test', eOnb);
  return u;
}

async function preparerActif(userId) {
  const { data: prof, error } = await admin.from('profiles').select('is_premium').eq('id', userId).maybeSingle();
  verifier('profil actif', error);
  if (!prof?.is_premium) {
    const { error: e } = await admin.from('profiles').update({ is_premium: true, premium_since: new Date().toISOString() }).eq('id', userId);
    verifier('Premium du compte actif', e);
  }
  const { count, error: e2 } = await admin.from('portfolios_positions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gt('quantite', 0);
  verifier('positions du compte actif', e2);
  if (count) return;
  const lignes = [];
  for (const p of POSITIONS_ACTIF) {
    const { data: c, error: e3 } = await admin.from('brvm_actions_daily').select('cours_jour, date_marche')
      .eq('code', p.code).not('cours_jour', 'is', null).order('date_marche', { ascending: false }).limit(1).maybeSingle();
    verifier(`cours de ${p.code}`, e3);
    if (!c) throw new Error(`Aucun cours pour ${p.code}.`);
    const entree = new Date(Date.parse(`${c.date_marche}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
    lignes.push({ user_id: userId, code: p.code, quantite: p.quantite, prix_entree: c.cours_jour, date_entree: entree, note: 'compte de test e2e' });
  }
  const { error: e4 } = await admin.from('portfolios_positions').insert(lignes);
  verifier('positions de test', e4);
  console.log('Positions de test ajoutées au compte actif.');
}

async function preparerDebutant(userId) {
  // Le profil « débutant » se définit par l'ABSENCE de position.
  const { error } = await admin.from('portfolios_positions').delete().eq('user_id', userId);
  verifier('positions du compte débutant', error);
}

/** Ouvre une session par lien de connexion (aucun e-mail envoyé) ; cookies au format exact de @supabase/ssr. */
async function ouvrirSession(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  verifier(`lien de connexion ${email}`, error);
  const jar = new Map();
  const sb = createServerClient(URL_SB, CLE_PUBLIQUE, {
    cookies: {
      getAll: () => [...jar].map(([name, c]) => ({ name, value: c.value })),
      setAll: (liste) => liste.forEach(({ name, value, options }) => (value ? jar.set(name, { value, options }) : jar.delete(name))),
    },
    global: { headers: ENTETES },
  });
  const { data: s, error: e } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  verifier(`session ${email}`, e);
  await new Promise((ok) => setTimeout(ok, 100)); // laisse @supabase/ssr écrire ses cookies
  if (jar.size === 0) throw new Error(`Aucun cookie de session produit pour ${email}.`);
  // Une seule session de test vivante par compte : les précédentes sont révoquées.
  const { error: eOut } = await admin.auth.admin.signOut(s.session.access_token, 'others');
  verifier('révocation des anciennes sessions', eOut);
  const maintenant = Math.floor(Date.now() / 1000);
  return [...jar].map(([name, c]) => ({
    name, value: c.value, domain: 'localhost', path: '/',
    expires: maintenant + (c.options?.maxAge ?? 7 * 86_400),
    httpOnly: false, secure: false, sameSite: 'Lax',
  }));
}

async function fermer() {
  for (const email of Object.values(COMPTES)) {
    const u = await chercherCompte(email);
    if (!u || u.app_metadata?.qa_e2e !== true) continue;
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    verifier(`lien ${email}`, error);
    const pub = createClient(URL_SB, CLE_PUBLIQUE, { auth: { persistSession: false }, global: { headers: ENTETES } });
    const { data: s, error: e } = await pub.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
    verifier(`session ${email}`, e);
    const { error: eOut } = await admin.auth.admin.signOut(s.session.access_token, 'global');
    verifier(`révocation ${email}`, eOut);
  }
  fs.rmSync(DOSSIER, { recursive: true, force: true });
  console.log('Sessions de test révoquées, fichiers supprimés.');
}

async function principal() {
  const args = process.argv.slice(2);
  if (args.includes('--fermer')) return fermer();

  const actif = await assurerCompte(COMPTES.actif);
  const debutant = await assurerCompte(COMPTES.debutant);
  await preparerActif(actif.id);
  await preparerDebutant(debutant.id);

  fs.mkdirSync(DOSSIER, { recursive: true });
  const ecrire = (nom, contenu) => {
    const f = path.join(DOSSIER, nom);
    fs.writeFileSync(f, JSON.stringify(contenu), { mode: 0o600 });
    return f;
  };
  const cookiesActif = await ouvrirSession(COMPTES.actif);
  const cookiesDebutant = await ouvrirSession(COMPTES.debutant);
  const vars = {
    PW_PREMIUM_STATE: ecrire('actif-state.json', { cookies: cookiesActif, origins: [] }),
    PW_COOKIES: ecrire('actif-cookies.json', cookiesActif),
    PW_COOKIES_ACTIF: ecrire('actif-cookies.json', cookiesActif),
    PW_COOKIES_DEBUTANT: ecrire('debutant-cookies.json', cookiesDebutant),
  };
  console.log(`Sessions de test prêtes (${DOSSIER}).`);

  if (!args.includes('--lancer')) {
    console.log('Variables à poser avant « npm run e2e » (PowerShell) :');
    for (const [k, v] of Object.entries(vars)) console.log(`  $env:${k}="${v}"`);
    return;
  }
  const fichiers = args.filter((a) => a !== '--lancer');
  const cli = path.join(RACINE, 'node_modules', '@playwright', 'test', 'cli.js');
  const r = spawnSync(process.execPath, [cli, 'test', ...fichiers], { cwd: RACINE, stdio: 'inherit', env: { ...process.env, ...vars } });
  process.exitCode = r.status ?? 1;
}

principal().catch((e) => {
  console.error(`Échec : ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
