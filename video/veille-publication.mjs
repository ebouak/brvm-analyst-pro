/**
 * Veille « séance sans publication » — 23:00 UTC, lundi-vendredi.
 *
 * NE DÉPEND PAS DU CHAÎNAGE bdfin.yml → video-seance.yml : si la clôture n'est
 * jamais confirmée, ou si le chaînage ne se déclenche pas, rien ne part, et
 * personne ne le saurait. Ce script regarde le RÉSULTAT (le marqueur
 * `chaine/<séance>.json` du bucket seance-video, posé seulement quand la
 * Chaîne a reçu la vidéo) et prévient l'exploitant sur Telegram
 * (TELEGRAM_CHAT_ID, conversation d'exploitation — jamais le canal public).
 *
 * Code 1 si une alerte est émise ou si une lecture échoue : le run est rouge,
 * donc visible dans /admin/controle (ops_workflows), pas seulement sur Telegram.
 * DRY_RUN=true : l'alerte est affichée, pas envoyée.
 *
 *   node veille-publication.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from './supabaseEntetes.mjs';
import { cheminTermine, decisionVeille, estOuvre, evaluerCloture, jourVeille, lireRunsDaily, objetExiste } from './cloture.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fichiers = [`${RACINE}/video/.env.local`, `${RACINE}/frontend/.env.local`]
  .filter(existsSync)
  .map((f) => readFileSync(f, 'utf8').replace(/^﻿/, ''));
const lire = (k) => {
  if (process.env[k]) return process.env[k].trim();
  for (const t of fichiers) {
    const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'));
    if (m) return m[1].trim().replace(/^"|"$/g, '');
  }
  return '';
};

const URL_SB = lire('SUPABASE_URL') || lire('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE = lire('SUPABASE_SERVICE_ROLE_KEY');
const JETON = lire('TELEGRAM_BOT_TOKEN');
const SALON = lire('TELEGRAM_CHAT_ID');
const DRY = process.env.DRY_RUN === 'true';

const alerterExploitant = async (texte) => {
  if (DRY) {
    console.log(`DRY_RUN — alerte non envoyée :\n${texte}`);
    return;
  }
  if (!JETON || !SALON) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID absents : alerte impossible');
  const r = await fetch(`https://api.telegram.org/bot${JETON}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: SALON, text: texte, disable_web_page_preview: true }),
  });
  const rep = await r.json().catch(() => ({}));
  // La réponse d'erreur peut citer l'URL appelée, donc le jeton : description seule.
  if (!rep.ok) throw new Error(`Telegram : ${rep.description ?? `HTTP ${r.status}`}`);
};

const jour = jourVeille(new Date());
try {
  if (!URL_SB || !SERVICE) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  const entetes = entetesSupabase(SERVICE);

  const r = await fetch(`${URL_SB}/rest/v1/market_calendar?select=date&is_trading_day=eq.false&date=eq.${jour}`, { headers: entetes });
  if (!r.ok) throw new Error(`market_calendar → HTTP ${r.status}`);
  const fermes = (await r.json()).map((l) => l.date);
  const ouvre = estOuvre(jour, fermes);

  let d;
  if (!ouvre) {
    d = decisionVeille({ jour, ouvre });
  } else {
    const chainePubliee = await objetExiste({ urlSupabase: URL_SB, entetes, chemin: `chaine/${jour}.json` });
    const termine = chainePubliee ? true : await objetExiste({ urlSupabase: URL_SB, entetes, chemin: cheminTermine(jour) });
    const cloture = chainePubliee ? null : evaluerCloture(jour, await lireRunsDaily({ urlSupabase: URL_SB, entetes, seance: jour }));
    d = decisionVeille({ jour, ouvre, chainePubliee, termine, cloture });
  }

  console.log(d.message);
  if (d.alerter) {
    await alerterExploitant(`⚠️ WESTBOURSE — ${d.message}`);
    console.log(`::error title=Séance sans publication (${jour})::${d.message.replace(/\n/g, ' ')}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`::error title=Veille de publication::${e.message}`);
  /* La veille elle-même en panne : on tente quand même de le dire. */
  await alerterExploitant(`⚠️ WESTBOURSE — veille de publication du ${jour} impossible : ${e.message}`).catch(() => {});
  process.exit(1);
}
