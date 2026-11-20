/**
 * Porte du workflow vidéo : faut-il générer, faut-il publier ?
 *
 * Tourne AVANT l'installation de Chromium, de ffmpeg et le rendu (≈ 40 min) :
 * le workflow est désormais déclenché à chaque fin de `bdfin.yml`, parfois
 * plusieurs fois par séance, et la plupart de ces passages n'ont rien à faire
 * (clôture pas encore confirmée, ou séance déjà publiée).
 *
 * Sortie (GITHUB_OUTPUT) : a_publier, generer, seance, raison.
 * Code 1 seulement si la base ou le stockage ne répond pas : une lecture
 * impossible ne doit jamais passer pour un « rien à faire ».
 *
 *   GENERATION_SEULE=true node porte.mjs
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from './supabaseEntetes.mjs';
import { cheminTermine, decisionPorte, evaluerCloture, lireRunsDaily, objetExiste } from './cloture.mjs';

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

const sortir = (cles) => {
  for (const [k, v] of Object.entries(cles)) {
    console.log(`${k} = ${v}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\n/g, ' ')}\n`, 'utf8');
  }
};

const generationSeule = process.env.GENERATION_SEULE === 'true';
if (generationSeule) {
  sortir({ ...decisionPorte({ generationSeule }), seance: '' });
  process.exit(0);
}

const URL_SB = lire('SUPABASE_URL') || lire('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE = lire('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_SB || !SERVICE) {
  console.error('::error title=Porte vidéo::SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (scraper_runs est réservé à la clé service).');
  process.exit(1);
}
const entetes = entetesSupabase(SERVICE);

try {
  /* Même séance que genere.mjs : la dernière ligne de brvm_actions_daily. */
  const r = await fetch(`${URL_SB}/rest/v1/brvm_actions_daily?select=date_marche&order=date_marche.desc&limit=1`, { headers: entetes });
  if (!r.ok) throw new Error(`brvm_actions_daily → HTTP ${r.status}`);
  const seance = (await r.json())[0]?.date_marche ?? null;
  if (!seance) throw new Error('aucune séance en base');

  const dejaPubliee = await objetExiste({ urlSupabase: URL_SB, entetes, chemin: cheminTermine(seance) });
  const cloture = dejaPubliee ? null : evaluerCloture(seance, await lireRunsDaily({ urlSupabase: URL_SB, entetes, seance }));
  const d = decisionPorte({ dejaPubliee, cloture });
  sortir({ ...d, seance });
  console.log(`::notice title=Porte vidéo (séance ${seance})::${d.raison}`);
} catch (e) {
  console.error(`::error title=Porte vidéo::lecture impossible — ${e.message}`);
  process.exit(1);
}
