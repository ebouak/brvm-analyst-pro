// Voix off de la vidéo « canaux » (WhatsApp et Telegram) : une piste par scène
// et leurs durées, dont canaux.tsx déduit la longueur de chaque scène. Le texte
// vient de canaux.json — la même source que les textes affichés.
// Mêmes moteurs et même règle qu'ecosysteme-voix.mjs : ElevenLabs (votre voix)
// dès que la clé est dans remotion/.env.local, sinon --denise ; si ElevenLabs
// est demandé mais indisponible, ÉCHEC plutôt qu'une autre voix en silence.
//
//   node canaux-voix.mjs            moteur auto
//   node canaux-voix.mjs --denise   forcer la voix de synthèse

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLE, VOIX, synthetiser } from './voix-elevenlabs.mjs';

const moteur = process.argv.includes('--denise') ? 'denise' : CLE ? 'elevenlabs' : 'denise';
if (moteur === 'elevenlabs' && !VOIX) {
  console.error('ELEVENLABS_VOICE_ID absent de remotion/.env.local — lancer `node ecosysteme-voix.mjs --lister`.');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(new URL('./canaux.json', import.meta.url), 'utf8'));
const dossier = fileURLToPath(new URL('./public/canaux/', import.meta.url));
mkdirSync(dossier, { recursive: true });

console.log(`moteur de voix : ${moteur === 'elevenlabs' ? 'ElevenLabs (votre voix)' : 'edge-tts Denise'}`);
const durees = {};
for (const s of plan.scenes) {
  const mp3 = `${dossier}${s.id}.mp3`;
  if (moteur === 'elevenlabs') await synthetiser(s.voix, mp3);
  else execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+4%', '--text', s.voix, '--write-media', mp3], { stdio: 'pipe' });
  durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  console.log(`${s.id.padEnd(12)} ${durees[s.id].toFixed(2)} s`);
}
writeFileSync(`${dossier}durees.json`, JSON.stringify({ ...durees, _moteur: moteur }, null, 2));
console.log(`total ${Object.entries(durees).reduce((a, [, d]) => a + d, 0).toFixed(1)} s de voix`);
