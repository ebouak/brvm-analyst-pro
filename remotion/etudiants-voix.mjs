// Voix off des deux vidéos « étudiants » (2026-11-18) : une piste par scène,
// ses mots horodatés (sous-titres) et sa durée, dont etudiants.tsx déduit la
// longueur de chaque scène. Le texte vient du plan JSON — la même source que
// les titres affichés. Même moteur que canaux-voix.mjs (edge-tts, Denise).
//
//   node etudiants-voix.mjs gratuit
//   node etudiants-voix.mjs academy
//   node etudiants-voix.mjs            (les deux)

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const demandes = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const videos = demandes.length ? demandes : ['gratuit', 'academy'];
const tts = fileURLToPath(new URL('./etudiants-tts.py', import.meta.url));

for (const video of videos) {
  const plan = JSON.parse(readFileSync(new URL(`./etudiants-${video}.json`, import.meta.url), 'utf8'));
  const dossier = fileURLToPath(new URL(`./public/etudiants/${video}/`, import.meta.url));
  mkdirSync(dossier, { recursive: true });
  const durees = {};
  for (const s of plan.scenes) {
    const mp3 = `${dossier}${s.id}.mp3`;
    execFileSync('python', [tts, plan.voixTts, plan.debit, s.voix, mp3, `${dossier}${s.id}.mots.json`], { stdio: 'pipe' });
    durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
    console.log(`${video} ${s.id.padEnd(12)} ${durees[s.id].toFixed(2)} s`);
  }
  writeFileSync(`${dossier}durees.json`, JSON.stringify(durees, null, 2));
  console.log(`${video} : ${Object.values(durees).reduce((a, d) => a + d, 0).toFixed(1)} s de voix`);
}
