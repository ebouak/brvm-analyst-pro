/**
 * Envoi du brief de clôture aux ABONNÉS.
 *
 * ── LE CHAÎNON QUI MANQUAIT ──
 * `/parametres/alertes` propose depuis la migration 0142 une case « Brief de
 * clôture · par email ». Elle n'était reliée à rien : cocher enregistrait un
 * consentement que personne n'honorait. Une case qui ne déclenche rien est une
 * promesse qu'on ne tient pas — pire qu'une case absente.
 *
 * ── DEUX MODES, ET UN SEUL EST AUTOMATIQUE ──
 *
 *  1. ABONNÉS (défaut, appelé par le cron après la publication de la vidéo).
 *     Destinataires : `notification_prefs.brief_email = true`, et eux seuls.
 *     Aucun bandeau : quelqu'un qui a coché ne doit jamais lire « vous recevez
 *     ceci une seule fois » — ce serait faux, et il l'a demandé.
 *
 *  2. DÉCOUVERTE (`--decouverte`, JAMAIS automatique). Envoi unique à tous les
 *     comptes, avec un bandeau qui dit que c'est unique et comment s'abonner.
 *
 *     ⚠️ CE MODE CONTREDIT UNE PROMESSE ÉCRITE. La campagne d'annonce du
 *     2026-09-24, partie aux 130 comptes, porte dans son premier bloc :
 *     « Vous recevez ce message une seule fois. Vous ne recevrez plus rien de
 *     notre part sans l'avoir demandé. » L'envoi de découverte rompt cette
 *     phrase. C'est une décision du responsable de traitement, pas une option
 *     technique : il exige `--decouverte` ET `--envoyer`, et le bandeau le
 *     reconnaît explicitement auprès du lecteur plutôt que de l'escamoter.
 *
 * ── IDEMPOTENCE SANS NOUVELLE MIGRATION ──
 * On réutilise `campagne_envois` (0142), dont la clé naturelle est
 * `(campagne, email)`. L'identifiant vaut `brief-<date de séance>` pour l'envoi
 * quotidien, `brief-decouverte` pour l'unique. Conséquences directes :
 * relancer le cron deux fois le même soir n'envoie rien une seconde fois, et
 * la découverte ne peut structurellement partir qu'une fois par adresse.
 *
 * ── MODE D'ESSAI PAR DÉFAUT ──
 * Sans `--envoyer`, rien ne part et rien n'est écrit. C'est l'inverse de la
 * convention du dépôt, et c'est délibéré : un envoi à des tiers ne doit jamais
 * être le comportement par défaut d'une commande qu'on lance pour voir.
 *
 *   node brief-envoi.mjs                      # essai, abonnés
 *   node brief-envoi.mjs --envoyer            # envoi réel aux abonnés
 *   node brief-envoi.mjs --decouverte         # essai, tous les comptes
 *   node brief-envoi.mjs --decouverte --envoyer
 *   node brief-envoi.mjs --seulement=a@b.c --envoyer
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from './supabaseEntetes.mjs';
import { sujet, texte, html } from './brief.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.VIDEO_OUT || `${RACINE}/gan-harness/video`;
const FICHE = `${OUT}/seance.json`;
const SITE = 'https://www.westbourse.com';
const PAGE_PREFS = `${SITE}/parametres/alertes`;

/** Pause entre deux envois : Resend jette une rafale. */
const PAUSE_MS = 600;
const dors = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Adresse MASQUÉE pour tout affichage. Les journaux d'exécution GitHub de ce
 * dépôt sont PUBLICS : un essai a déjà exposé une centaine d'adresses le
 * 2026-09-24. Voir `scraper/scripts/campagne-landing.mjs`.
 */
const masquer = (email) => {
  const s = typeof email === 'string' ? email : '';
  const at = s.lastIndexOf('@');
  if (at < 1) return '(adresse illisible)';
  return `${s.slice(0, Math.min(2, at))}…@${s.slice(at + 1)}`;
};

/* ───────────────────────── Arguments ───────────────────────── */

const args = process.argv.slice(2);
const ARME = args.includes('--envoyer');
const DECOUVERTE = args.includes('--decouverte');
const seulement = (args.find((a) => a.startsWith('--seulement=')) ?? '').split('=')[1] || null;

const inconnu = args.find(
  (a) => !['--envoyer', '--decouverte'].includes(a) && !a.startsWith('--seulement='),
);
if (inconnu) {
  console.error(`Option inconnue : ${inconnu}. Rien n'a été fait.`);
  process.exit(1);
}
if (seulement && !seulement.includes('@')) {
  console.error(`--seulement attend une adresse email, reçu « ${seulement} ».`);
  process.exit(1);
}

/* ───────────────────────── La séance ───────────────────────── */

if (!existsSync(FICHE)) {
  console.error(`seance.json introuvable dans ${OUT} — lancer genere.mjs d'abord.`);
  process.exit(1);
}
const m = JSON.parse(readFileSync(FICHE, 'utf8'));

/* Le même verrou que la vidéo : une séance jugée non publiable ne part pas.
   Un brief faux vaut moins qu'un soir sans brief. */
if (!m.publiable) {
  const manque = Object.entries(m.controles ?? {})
    .filter(([, v]) => !v)
    .map(([k]) => k)
    .join(', ');
  console.log(`ENVOI ANNULÉ — la séance ne passe pas les contrôles : ${manque || 'inconnus'}`);
  process.exit(0);
}

const CAMPAGNE = DECOUVERTE ? 'brief-decouverte' : `brief-${m.seance}`;

const AVERTISSEMENT = DECOUVERTE
  ? `Vous recevez ce brief <strong>une seule fois</strong>, pour découvrir ce qu’il contient. ` +
    `Pour le recevoir chaque soir de séance, cochez « Brief de clôture » dans ` +
    `<a href="${PAGE_PREFS}" style="color:#6B5424;font-weight:600">vos préférences</a>. ` +
    `Sans cela, ce sera le dernier.`
  : null;

/* ───────────────────────── Environnement ───────────────────────── */

const envLocal = [`${RACINE}/video/.env.local`, `${RACINE}/frontend/.env.local`]
  .filter((f) => existsSync(f))
  .map((f) => readFileSync(f, 'utf8').replace(/^﻿/, ''))
  .join('\n');
const lire = (...cles) => {
  for (const k of cles) {
    if (process.env[k]) return process.env[k].trim();
    const t = envLocal.match(new RegExp(`^${k}=(.*)$`, 'm'));
    if (t) return t[1].trim().replace(/^"|"$/g, '');
  }
  return '';
};

const URL_SB = lire('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const SERVICE = lire('SUPABASE_SERVICE_ROLE_KEY');
const RESEND = lire('RESEND_API_KEY');
const DE = lire('ALERTS_EMAIL_FROM');

const entete = `=== Brief « ${CAMPAGNE} » — ${DECOUVERTE ? 'DÉCOUVERTE (tous les comptes)' : 'abonnés'} · ${
  ARME ? 'ENVOI RÉEL' : "MODE D'ESSAI : rien ne sera envoyé, rien ne sera écrit"
} ===`;
console.log(entete);

if (!URL_SB || !SERVICE) {
  console.log('SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY absent(s) — impossible de lister les destinataires.');
  process.exit(ARME ? 1 : 0);
}
if (ARME && (!RESEND || !DE)) {
  console.error('RESEND_API_KEY et/ou ALERTS_EMAIL_FROM absent(s) : envoi impossible.');
  process.exit(1);
}

/* ───────────────────────── Lectures ───────────────────────── */

const H = entetesSupabase(SERVICE);
const api = async (chemin, init) => {
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${(await r.text()).slice(0, 180)}`);
  return r.status === 204 ? null : r.json();
};

/** PostgREST tronque à 1000 lignes EN SILENCE : on pagine toujours. */
async function paginer(base) {
  const tout = [];
  for (let page = 0; ; page++) {
    const lot = await api(`${base}&limit=1000&offset=${page * 1000}`);
    tout.push(...lot);
    if (lot.length < 1000) return tout;
  }
}

/* Destinataires. En mode abonnés on part des CONSENTEMENTS, jamais des
   comptes : c'est la différence entre servir quelqu'un et le solliciter. */
let destinataires;
if (seulement) {
  destinataires = [{ email: seulement, user_id: null }];
} else if (DECOUVERTE) {
  const profils = await paginer('profiles?select=id,email&email=not.is.null&order=created_at.asc');
  destinataires = profils.map((p) => ({ email: p.email, user_id: p.id }));
} else {
  const prefs = await paginer('notification_prefs?select=user_id&brief_email=is.true&order=user_id.asc');
  if (prefs.length === 0) {
    console.log('Aucun abonné au brief par email. Rien à faire — ce n’est pas un échec.');
    console.log('=== FIN ===');
    process.exit(0);
  }
  const ids = prefs.map((p) => p.user_id);
  const profils = await paginer(
    `profiles?select=id,email&email=not.is.null&id=in.(${ids.join(',')})&order=id.asc`,
  );
  destinataires = profils.map((p) => ({ email: p.email, user_id: p.id }));
}

/* Déjà servis pour cette campagne : la garantie du « une seule fois ». */
const deja = new Set(
  (await paginer(`campagne_envois?select=email&campagne=eq.${encodeURIComponent(CAMPAGNE)}&order=email.asc`)).map(
    (r) => r.email,
  ),
);

const vus = new Set();
const aTraiter = [];
let sautes = 0;
for (const d of destinataires) {
  if (!d.email || !d.email.includes('@') || vus.has(d.email) || deja.has(d.email)) {
    sautes++;
    continue;
  }
  vus.add(d.email);
  aTraiter.push(d);
}

console.log(`Destinataires éligibles : ${aTraiter.length} · sautés : ${sautes}`);

/* ───────────────────────── Composition ───────────────────────── */

const SUJET = sujet(m);
const CORPS_HTML = html(m, { avertissement: AVERTISSEMENT });
const CORPS_TEXTE = DECOUVERTE
  ? `Vous recevez ce brief une seule fois, pour découvrir ce qu'il contient.\n` +
    `Pour le recevoir chaque soir de séance, cochez « Brief de clôture » ici : ${PAGE_PREFS}\n` +
    `Sans cela, ce sera le dernier.\n\n${texte(m)}`
  : texte(m);

console.log(`Objet : ${SUJET}`);

/* ───────────────────────── Envoi ───────────────────────── */

let envoyes = 0;
let echecs = 0;
let ecritures = 0;
let arret = null;

for (const d of aTraiter) {
  if (!ARME) {
    console.log(`  [ESSAI] serait envoyé à ${masquer(d.email)}`);
    continue;
  }

  let statut = 'envoye';
  let raison = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND}`,
        'Content-Type': 'application/json',
        'User-Agent': 'westbourse-brief/1.0',
      },
      body: JSON.stringify({
        from: DE,
        to: [d.email],
        subject: SUJET,
        text: CORPS_TEXTE,
        html: CORPS_HTML,
        headers: { 'List-Unsubscribe': `<${PAGE_PREFS}>` },
      }),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
    envoyes++;
  } catch (e) {
    statut = 'echec';
    raison = e.message;
    echecs++;
  }

  /* Journalisation IMMÉDIATE, avant le destinataire suivant : une
     interruption laisse la base cohérente avec ce qui a réellement été tenté. */
  try {
    await api('campagne_envois', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ campagne: CAMPAGNE, email: d.email, user_id: d.user_id, statut, raison }),
    });
    ecritures++;
  } catch (e) {
    /* Plus strict que le minimum : on ARRÊTE. Continuer à envoyer sans pouvoir
       journaliser, c'est se condamner à ne plus savoir qui a reçu quoi — et
       donc à réenvoyer à l'aveugle. */
    arret = `journalisation impossible après ${masquer(d.email)} : ${e.message}`;
    break;
  }

  console.log(`  ${masquer(d.email)} — ${statut}`);
  await dors(PAUSE_MS);
}

/* ───────────────────────── Bilan ───────────────────────── */

console.log('=== BILAN ===');
console.log(`  éligibles ${aTraiter.length} · sautés ${sautes} · envoyés ${envoyes} · échecs ${echecs}`);

if (!ARME) {
  console.log("MODE D'ESSAI — aucun email envoyé, aucune ligne écrite.");
  process.exit(0);
}
if (arret) {
  console.error(`ARRÊT : ${arret}`);
  process.exit(1);
}
/* Un workflow vert ne prouve pas qu'un message soit parti : ce dépôt a vécu
   sept semaines de panne d'emails invisible. On échoue bruyamment. */
if (envoyes > 0 && ecritures === 0) {
  console.error("Des envois ont eu lieu mais AUCUN n'a pu être journalisé.");
  process.exit(1);
}
if (echecs > 0 && envoyes === 0) {
  console.error('Aucun envoi réussi.');
  process.exit(1);
}
console.log('=== FIN ===');
