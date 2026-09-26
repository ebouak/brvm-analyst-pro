/**
 * Reprise d'historique 2007-2022 des cours actions — PASSE UNIQUE, jamais un cron.
 *
 * Source : point d'entrée JSON de sikafinance.com (`POST /api/general/GetHistos`),
 * celui qu'utilise leur propre page « historiques ». Le robots.txt du site
 * n'interdit que /listes/displaylist, /portif/displayp et /docs/* ; /api/ n'en
 * fait pas partie. Les cours de bourse sont des faits publics produits par la
 * BRVM. Autorisation explicite du responsable du projet, 2026-09-22.
 *
 * Règles de politesse et de sûreté, dans cet ordre de priorité :
 *  1. DÉLAI de 2 s entre deux requêtes, jamais de parallélisme ;
 *  2. en-tête User-Agent identifiant WESTBOURSE et un contact ;
 *  3. ARRÊT IMMÉDIAT au premier signe de refus (401, 403, 429, 5xx, ou erreur
 *     inconnue) — on ne réessaie pas, on ne contourne pas ;
 *  4. reprise possible : l'avancement est noté dans un fichier local, donc un
 *     arrêt ne fait pas recommencer depuis le début.
 *
 * Règles d'honnêteté sur la donnée :
 *  · écriture en `ignore-duplicates` : une séance DÉJÀ en base n'est jamais
 *    écrasée — nos lignes vérifiées priment sur celles d'un tiers ;
 *  · `valeur_echangee` reste NULLE : la page de la source la CALCULE
 *    (volume × (haut+bas)/2), c'est une estimation, pas un montant échangé.
 *    On ne range pas une estimation dans une colonne qui contient des faits ;
 *  · `cours_precedent` et `variation_pct` restent nuls ici : ils se déduisent
 *    d'une passe SQL sur la série complète, sans trou aux bornes de trimestre.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const UA = 'WESTBOURSE-histo/1.0 (+https://www.westbourse.com ; contact ebouak@gmail.com)';
const API = 'https://www.sikafinance.com/api/general/GetHistos';
const PAGE = 'https://www.sikafinance.com/marches/historiques/SNTS.sn';
const DELAI_MS = 2000;
const DEBUT = Number(process.env.HISTO_DEBUT ?? 2007);
const FIN = Number(process.env.HISTO_FIN ?? 2022);
const ETAT = resolve(process.env.TEMP ?? '.', 'westbourse-histo-etat.json');

const env = Object.fromEntries(
  readFileSync(resolve('..', 'frontend', '.env.local'), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) { console.error('Configuration Supabase absente de frontend/.env.local'); process.exit(2); }

const dors = (ms) => new Promise((r) => setTimeout(r, ms));
const etat = existsSync(ETAT) ? JSON.parse(readFileSync(ETAT, 'utf8')) : { faits: [], ecrits: 0 };
const faits = new Set(etat.faits);
const noter = () => { mkdirSync(dirname(ETAT), { recursive: true }); writeFileSync(ETAT, JSON.stringify({ faits: [...faits], ecrits: etat.ecrits })); };

/** Refus explicite de la source : on s'arrête, on ne contourne pas. */
class Refus extends Error {}

/**
 * Un incident RÉSEAU (coupure, DNS, socket avortée) n'est pas un refus de la
 * source : on réessaie trois fois en espaçant, puis on renonce. Un refus
 * explicite (401/403/429/5xx) n'est JAMAIS réessayé — voir Refus.
 */
async function avecReprise(fn, quoi) {
  let derniere;
  for (let essai = 1; essai <= 3; essai++) {
    try { return await fn(); } catch (e) {
      if (e instanceof Refus) throw e;
      derniere = e;
      console.warn(`  incident réseau (${essai}/3) sur ${quoi} : ${e.cause?.code ?? e.message}`);
      await dors(DELAI_MS * 5 * essai);
    }
  }
  throw derniere;
}

async function histos(ticker, du, au) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'User-Agent': UA, Referer: PAGE },
    body: JSON.stringify({ ticker, datedeb: du, datefin: au, xperiod: '0' }),
  });
  if ([401, 403, 429].includes(r.status) || r.status >= 500) throw new Refus(`HTTP ${r.status} sur ${ticker} ${du}`);
  if (!r.ok) throw new Refus(`HTTP inattendu ${r.status} sur ${ticker} ${du}`);
  const j = await r.json().catch(() => null);
  if (!j) throw new Refus(`réponse illisible sur ${ticker} ${du}`);
  if (!j.lst || !j.lst.length) {
    if (j.error === 'nodata') return [];                 // valeur non cotée à cette période : normal
    throw new Refus(`erreur « ${j.error} » sur ${ticker} ${du}`);
  }
  return j.lst;
}

/** « 04/01/2010 » → « 2010-01-04 ». Toute autre forme est rejetée, jamais devinée. */
function isoDepuisFr(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const nombre = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function lignes(code, lst) {
  const out = [];
  for (const r of lst) {
    const d = isoDepuisFr(r.Date);
    const cours = nombre(r.Close);
    if (!d || cours == null || cours <= 0) continue;     // un zéro est un trou de collecte, pas un cours
    out.push({
      code, date_marche: d, cours_jour: cours,
      ouverture: nombre(r.Open), plus_haut: nombre(r.High), plus_bas: nombre(r.Low),
      volume: nombre(r.Volume) == null ? null : Math.round(Number(r.Volume)),
    });
  }
  return out;
}

async function ecrire(rows) {
  if (!rows.length) return 0;
  const r = await fetch(`${SB}/rest/v1/brvm_actions_daily?on_conflict=code,date_marche`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal', 'User-Agent': 'westbourse-histo/1.0' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`écriture refusée : ${r.status} ${(await r.text()).slice(0, 200)}`);
  return rows.length;
}

async function tickers() {
  const r = await fetch(PAGE, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Refus(`page historiques : HTTP ${r.status}`);
  const html = await r.text();
  const map = new Map();
  for (const m of html.matchAll(/<option value="([A-Z0-9]+)\.([a-z]{2})"/g)) map.set(m[1], `${m[1]}.${m[2]}`);
  return map;
}

const TRIMESTRES = [['01-01', '03-31'], ['04-01', '06-30'], ['07-01', '09-30'], ['10-01', '12-31']];

(async () => {
  const map = await tickers();
  await dors(DELAI_MS);

  const r = await fetch(`${SB}/rest/v1/brvm_instruments?select=code&type=eq.action&order=code`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'User-Agent': 'westbourse-histo/1.0' } });
  const codes = (await r.json()).map((x) => x.code).filter((c) => map.has(c));
  const absents = (await (await fetch(`${SB}/rest/v1/brvm_instruments?select=code&type=eq.action`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'User-Agent': 'westbourse-histo/1.0' } })).json()).map((x) => x.code).filter((c) => !map.has(c));
  if (absents.length) console.log(`sans correspondance chez la source (ignorés) : ${absents.join(', ')}`);

  const total = codes.length * (FIN - DEBUT + 1) * 4;
  console.log(`${codes.length} valeurs × ${FIN - DEBUT + 1} ans × 4 trimestres = ${total} requêtes, ~${Math.round((total * DELAI_MS) / 60000)} min`);

  let n = 0, ecrits = etat.ecrits;
  try {
    for (const code of codes) {
      let parCode = 0;
      for (let an = DEBUT; an <= FIN; an++) {
        for (const [d, f] of TRIMESTRES) {
          const cle = `${code}:${an}${d}`;
          n++;
          if (faits.has(cle)) continue;
          const lst = await avecReprise(() => histos(map.get(code), `${an}-${d}`, `${an}-${f}`), `${code} ${an}-${d}`);
          const rows = lignes(code, lst);
          ecrits += await avecReprise(() => ecrire(rows), `écriture ${code} ${an}-${d}`);
          parCode += rows.length;
          faits.add(cle); etat.ecrits = ecrits; noter();
          await dors(DELAI_MS);
        }
      }
      console.log(`${code.padEnd(6)} ${String(parCode).padStart(5)} séances  (${n}/${total}, ${ecrits} lignes proposées)`);
    }
    console.log(`\nTerminé. ${ecrits} lignes proposées à la base (les doublons ont été ignorés).`);
  } catch (e) {
    if (e instanceof Refus) {
      console.error(`\nARRÊT — la source a refusé : ${e.message}`);
      console.error(`Avancement conservé dans ${ETAT} : relancer reprendra où l'on s'est arrêté.`);
      process.exit(3);
    }
    throw e;
  }
})();
