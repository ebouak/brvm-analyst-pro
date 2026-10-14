// Publie la vidéo d'une leçon Academy sur le site : encodage web, image
// d'affiche, puis envoi dans le bucket PRIVÉ `academy-videos` (migration 0154)
// sous <slug>/lecon-<n>.mp4 et .jpg. La page de la leçon affiche le lecteur dès
// que le fichier existe ; la route /api/academy/video vérifie l'accès avant de
// signer l'URL.
//
// Usage : node academy-publie.mjs n1-l1        (après le rendu out/academy-n1-l1.mp4)
//
// Clé service_role lue dans video/.env.local puis frontend/.env.local, comme
// video/publie.mjs ; jamais affichée. Le slug et le numéro viennent de
// academy/<lecon>.json (champs `slug`, `numero`).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from '../video/supabaseEntetes.mjs';

const lecon = process.argv[2];
if (!lecon || !/^[a-z0-9-]+$/.test(lecon)) {
  console.error('Usage : node academy-publie.mjs <lecon>   (ex. n1-l1)');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(new URL(`./academy/${lecon}.json`, import.meta.url), 'utf8'));
if (!plan.slug || !Number.isInteger(plan.numero)) {
  console.error(`academy/${lecon}.json doit porter « slug » (cours) et « numero » (leçon, 1-indexé).`);
  process.exit(1);
}

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const envLocal = [`${RACINE}video/.env.local`, `${RACINE}frontend/.env.local`]
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
const CLE = lire('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_SB || !CLE) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans .env.local'); process.exit(1); }

const source = fileURLToPath(new URL(`./out/academy-${lecon}.mp4`, import.meta.url));
const web = fileURLToPath(new URL(`./out/academy-${lecon}-web.mp4`, import.meta.url));
const affiche = fileURLToPath(new URL(`./out/academy-${lecon}.jpg`, import.meta.url));
if (!existsSync(source)) { console.error(`Rendu absent : ${source}`); process.exit(1); }

// faststart : l'index du fichier en tête, pour que la lecture démarre avant la fin du téléchargement.
if (!existsSync(web) || statSync(web).mtimeMs < statSync(source).mtimeMs) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-c:v', 'libx264', '-preset', 'medium', '-crf', '25',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', web], { stdio: 'inherit' });
}
// Affiche : l'écran d'ouverture (logo, titre, sommaire) une fois posé.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '4', '-i', source, '-frames:v', '1', '-q:v', '3', affiche], { stdio: 'inherit' });

const PLAFOND = 50 * 1024 * 1024; // file_size_limit du bucket (0154)
const envoyer = async (fichier, chemin, type) => {
  const octets = readFileSync(fichier);
  if (octets.length > PLAFOND) throw new Error(`${chemin} : ${(octets.length / 1e6).toFixed(1)} Mo, au-delà du plafond de 50 Mo du bucket`);
  const r = await fetch(`${URL_SB}/storage/v1/object/academy-videos/${chemin}`, {
    method: 'POST',
    headers: { ...entetesSupabase(CLE), 'Content-Type': type, 'x-upsert': 'true', 'Cache-Control': 'max-age=3600', 'User-Agent': 'westbourse-academy-publie/1' },
    body: octets,
  });
  if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  console.log(`envoyé  ${chemin}  ${(octets.length / 1e6).toFixed(1)} Mo`);
};

await envoyer(affiche, `${plan.slug}/lecon-${plan.numero}.jpg`, 'image/jpeg');
await envoyer(web, `${plan.slug}/lecon-${plan.numero}.mp4`, 'video/mp4');
console.log(`Publiée : /formations/academy/${plan.slug}?lecon=${plan.numero}`);
