// Publie la vidéo finale d'une capsule Module Academy dans le bucket PRIVÉ
// `academy-videos` (migration 0154) sous `<slug>/lecon-<n>.mp4` et `.jpg`.
//
// Usage : node video/capsule-module/publie.mjs n1-m1
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from '../supabaseEntetes.mjs';

const id = process.argv[2];
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage : node video/capsule-module/publie.mjs <id>  (ex. n1-m1)');
  process.exit(1);
}

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '../..');
const PLAN_PATH = path.join(ICI, 'capsules', `${id}.json`);
if (!existsSync(PLAN_PATH)) {
  console.error(`Capsule introuvable : ${PLAN_PATH}`);
  process.exit(1);
}
const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
if (!plan.slug || !Number.isInteger(plan.numero)) {
  console.error(`capsules/${id}.json doit porter « slug » et « numero ».`);
  process.exit(1);
}

const envLocal = [path.join(RACINE, 'video', '.env.local'), path.join(RACINE, 'frontend', '.env.local')]
  .filter((f) => existsSync(f))
  .map((f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, ''))
  .join('\n');
const lire = (...cles) => {
  for (const k of cles) {
    if (process.env[k]) return process.env[k].trim();
    const m = envLocal.match(new RegExp(`^${k}=(.*)$`, 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
};

const URL_SB = lire('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const CLE = lire('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_SB || !CLE) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans .env.local');
  process.exit(1);
}

const OUT = path.join(RACINE, 'video', 'out', 'capsule-module', id);
const source = path.join(OUT, `${id}-final.mp4`);
const web = path.join(OUT, `${id}-web.mp4`);
const affiche = path.join(OUT, `${id}-poster.jpg`);
if (!existsSync(source) || !existsSync(affiche)) {
  console.error(`Rendu absent : ${source} ou ${affiche}`);
  process.exit(1);
}

if (!existsSync(web) || statSync(web).mtimeMs < statSync(source).mtimeMs) {
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', source, '-c', 'copy', '-movflags', '+faststart', web],
    { stdio: 'inherit' },
  );
}

const PLAFOND = 50 * 1024 * 1024;
const envoyer = async (fichier, chemin, type) => {
  const octets = readFileSync(fichier);
  if (octets.length > PLAFOND) {
    throw new Error(`${chemin} : ${(octets.length / 1e6).toFixed(1)} Mo dépasse le plafond de 50 Mo`);
  }
  const r = await fetch(`${URL_SB}/storage/v1/object/academy-videos/${chemin}`, {
    method: 'POST',
    headers: {
      ...entetesSupabase(CLE),
      'Content-Type': type,
      'x-upsert': 'true',
      'Cache-Control': 'max-age=3600',
      'User-Agent': 'westbourse-academy-publie/1',
    },
    body: octets,
  });
  if (!r.ok) {
    throw new Error(`${chemin} : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  console.log(`envoyé  ${chemin}  ${(octets.length / 1e6).toFixed(2)} Mo`);
};

await envoyer(affiche, `${plan.slug}/lecon-${plan.numero}.jpg`, 'image/jpeg');
await envoyer(web, `${plan.slug}/lecon-${plan.numero}.mp4`, 'video/mp4');
console.log(`Publiée : /formations/academy/${plan.slug}?lecon=${plan.numero}`);
