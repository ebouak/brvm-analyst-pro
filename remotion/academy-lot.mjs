// Production en lot des vidéos Academy, leçon par leçon, dans l'ordre donné :
// script (depuis la leçon publiée) → voix → rendu → publication sur le site.
// S'arrête net quand le crédit de voix ne couvre plus la leçon suivante (code 3
// d'academy-voix.mjs) : aucune leçon n'est publiée à moitié doublée. Toute autre
// erreur arrête aussi le lot — on ne publie pas sur une base douteuse.
//
// Usage : node academy-lot.mjs academy-niveau-1-initiation:2-11 academy-niveau-2-fondamental:1-7 …
// Journal : out/academy-lot.log

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ici = fileURLToPath(new URL('.', import.meta.url));
const journal = `${ici}out/academy-lot.log`;
const log = (m) => { const l = `${new Date().toISOString().slice(0, 19)} ${m}`; console.log(l); appendFileSync(journal, l + '\n'); };

const PREFIXES = {
  'academy-niveau-1-initiation': 'n1', 'academy-niveau-2-fondamental': 'n2',
  'academy-niveau-3-technique': 'n3', 'academy-niveau-4-expert': 'n4',
  'ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang': 'ipo',
  'comprendre-le-per-et-la-valorisation-a-la-brvm': 'per',
  'suivi-dangote-brvm-ipo': 'dangote', 'etudes-de-cas-reels-brvm': 'cas',
};

const taches = process.argv.slice(2).flatMap((arg) => {
  const [slug, plage] = arg.split(':');
  const [a, b] = plage.split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => ({ slug, n: a + i, id: `${PREFIXES[slug]}-l${a + i}` }));
});

const lancer = (cmd, args) => spawnSync(cmd, args, { cwd: ici, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32' });

log(`lot : ${taches.map((t) => t.id).join(' ')}`);
for (const t of taches) {
  const debut = Date.now();
  let r = lancer('node', ['academy-depuis-cours.mjs', t.slug, String(t.n)]);
  if (r.status !== 0) { log(`${t.id} ÉCHEC script : ${(r.stderr || r.stdout).trim().slice(-300)}`); process.exit(1); }
  log(r.stdout.trim());

  r = lancer('node', ['academy-voix.mjs', t.id]);
  if (r.status === 3) { log(`${t.id} ARRÊT : ${r.stderr.trim().split('\n').pop()}`); process.exit(3); }
  if (r.status !== 0) { log(`${t.id} ÉCHEC voix : ${(r.stderr || r.stdout).trim().slice(-300)}`); process.exit(1); }
  log(`${t.id} voix : ${r.stdout.trim().split('\n').filter((l) => /crédit|total/.test(l)).join(' · ')}`);

  // Props par fichier : sous Windows, le shell mutile les guillemets d'un JSON en ligne.
  writeFileSync(`${ici}out/props-${t.id}.json`, JSON.stringify({ lecon: t.id, section: null }));
  r = lancer('npx', ['remotion', 'render', 'index.ts', 'academy-lecon', `out/academy-${t.id}.mp4`, '--codec', 'h264', '--crf', '20',
    `--props=out/props-${t.id}.json`, '--log=error']);
  if (r.status !== 0 || !existsSync(`${ici}out/academy-${t.id}.mp4`)) { log(`${t.id} ÉCHEC rendu : ${(r.stderr || r.stdout).trim().slice(-300)}`); process.exit(1); }

  r = lancer('node', ['academy-publie.mjs', t.id]);
  if (r.status !== 0) { log(`${t.id} ÉCHEC publication : ${(r.stderr || r.stdout).trim().slice(-300)}`); process.exit(1); }
  const plan = JSON.parse(readFileSync(`${ici}public/academy/${t.id}/plan.json`, 'utf8'));
  const duree = Object.values(plan.durees).reduce((a, d) => a + d, 0);
  log(`${t.id} PUBLIÉE · ${Math.floor(duree / 60)} min ${Math.round(duree % 60)} s de voix · ${Math.round((Date.now() - debut) / 60000)} min de production · /formations/academy/${t.slug}?lecon=${t.n}`);
}
log('lot terminé');
