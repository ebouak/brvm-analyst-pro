/**
 * Combien de destinataires restent à servir pour une campagne de brief ?
 *
 * POURQUOI CE SCRIPT EXISTE SÉPARÉMENT. Le rattrapage tourne tous les matins,
 * mais l'envoi exige un `seance.json`, donc une génération de vidéo de dix
 * minutes (Chromium, ffmpeg, synthèse vocale). Lancer tout cela pour découvrir
 * qu'il ne reste personne serait dix minutes de calcul quotidien pour rien, et
 * pour toujours — le rattrapage n'ayant pas de fin naturelle.
 *
 * Ce compte, lui, ne demande que deux lectures. Le workflow s'en sert pour
 * décider s'il vaut la peine d'aller plus loin.
 *
 * Il n'envoie rien, n'écrit rien. Il imprime un nombre.
 *
 *   node brief-reste.mjs --campagne=brief-decouverte
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from './supabaseEntetes.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const campagne =
  (process.argv.slice(2).find((a) => a.startsWith('--campagne=')) ?? '').split('=')[1] || 'brief-decouverte';

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

/** Sans identifiants on ne peut pas conclure « personne » : on laisse passer. */
function rendre(nombre, note) {
  console.log(`${note} → reste ${nombre}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `nombre=${nombre}\n`);
}

if (!URL_SB || !SERVICE) {
  rendre(-1, 'Identifiants Supabase absents — impossible de compter');
  process.exit(0);
}

const H = entetesSupabase(SERVICE);
const compter = async (chemin) => {
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) throw new Error(`${chemin} → ${r.status}`);
  return Number((r.headers.get('content-range') ?? '/0').split('/')[1] ?? 0);
};

/* On ne compte comme servis que les envois RÉUSSIS : un échec doit rester
   retentable. Même règle que `brief-envoi.mjs` — si l'une change, l'autre doit
   suivre, sinon le rattrapage se croira terminé alors qu'il ne l'est pas. */
const comptes = await compter('profiles?select=id&email=not.is.null');
const servis = await compter(
  `campagne_envois?select=id&campagne=eq.${encodeURIComponent(campagne)}&statut=eq.envoye`,
);

rendre(Math.max(0, comptes - servis), `${comptes} comptes, ${servis} déjà servis pour « ${campagne} »`);
