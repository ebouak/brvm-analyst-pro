// Voix off de la vidéo « écosystème » : une piste par scène (edge-tts, même
// voix que la vidéo de séance), et leurs durées, dont la composition déduit la
// longueur de chaque scène. Le texte vient d'ecosysteme.json — la même source
// que les textes affichés.
//
// Usage : node ecosysteme-voix.mjs  →  public/ecosysteme/<id>.mp3 + durees.json

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const plan = JSON.parse(readFileSync(new URL('./ecosysteme.json', import.meta.url), 'utf8'));
const dossier = fileURLToPath(new URL('./public/ecosysteme/', import.meta.url));
mkdirSync(dossier, { recursive: true });

const durees = {};
for (const s of plan.scenes) {
  const mp3 = `${dossier}${s.id}.mp3`;
  execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+2%', '--text', s.voix, '--write-media', mp3], { stdio: 'pipe' });
  durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  console.log(`${s.id.padEnd(16)} ${durees[s.id].toFixed(2)} s`);
}
writeFileSync(`${dossier}durees.json`, JSON.stringify(durees, null, 2));
console.log(`total ${Object.values(durees).reduce((a, b) => a + b, 0).toFixed(1)} s de voix`);
