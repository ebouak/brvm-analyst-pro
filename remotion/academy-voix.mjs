// Voix off d'une section Academy : une piste par scène, puis le plan complet
// (scènes + durées mesurées) dans public/academy/<section>/plan.json, que lit
// la composition academy-section. Même moteur que ecosysteme-voix.mjs :
// ElevenLabs (voix de l'auteur) dès que la clé est dans remotion/.env.local,
// sinon edge-tts Denise. Si ElevenLabs est demandé mais indisponible, le
// script échoue au lieu de changer de voix en silence.
//
// Usage :
//   node academy-voix.mjs n1-l1-s1            moteur auto
//   node academy-voix.mjs n1-l1-s1 --denise   forcer la voix de synthèse

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLE, VOIX, synthetiser } from './voix-elevenlabs.mjs';

const section = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!section || !/^[a-z0-9-]+$/.test(section)) {
  console.error('Usage : node academy-voix.mjs <section>   (ex. n1-l1-s1)');
  process.exit(1);
}

const moteur = process.argv.includes('--denise') ? 'denise' : CLE ? 'elevenlabs' : 'denise';
if (moteur === 'elevenlabs' && !VOIX) {
  console.error('ELEVENLABS_VOICE_ID absent de remotion/.env.local — lancer `node ecosysteme-voix.mjs --lister`.');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(new URL(`./academy/${section}.json`, import.meta.url), 'utf8'));
const dossier = fileURLToPath(new URL(`./public/academy/${section}/`, import.meta.url));
mkdirSync(dossier, { recursive: true });

console.log(`section ${section} · moteur : ${moteur === 'elevenlabs' ? 'ElevenLabs (votre voix)' : 'edge-tts Denise'}`);
const durees = {};
for (const s of plan.scenes) {
  const mp3 = `${dossier}${s.id}.mp3`;
  if (moteur === 'elevenlabs') await synthetiser(s.voix, mp3);
  else execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+2%', '--text', s.voix, '--write-media', mp3], { stdio: 'pipe' });
  durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  console.log(`${s.id.padEnd(14)} ${durees[s.id].toFixed(2)} s`);
}
writeFileSync(`${dossier}plan.json`, JSON.stringify({ ...plan, section, moteur, durees }, null, 2));
console.log(`total ${Object.values(durees).reduce((a, d) => a + d, 0).toFixed(1)} s de voix`);
