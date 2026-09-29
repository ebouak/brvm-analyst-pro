// Voix off de la vidéo « écosystème » : une piste par scène, et leurs durées,
// dont la composition déduit la longueur de chaque scène. Le texte vient
// d'ecosysteme.json — la même source que les textes affichés.
//
// Deux moteurs :
//   · elevenlabs (par défaut dès que la clé est présente) — la voix de
//     l'auteur, clonée dans son compte ElevenLabs ;
//   · denise — edge-tts fr-FR-DeniseNeural, la voix des vidéos de séance.
//
// La clé ne passe JAMAIS par le code ni par une conversation : elle est lue
// dans remotion/.env.local (ignoré par git), à remplir soi-même :
//   ELEVENLABS_API_KEY=...
//   ELEVENLABS_VOICE_ID=...        (voir --lister)
//
// Usage :
//   node ecosysteme-voix.mjs               moteur auto (elevenlabs si clé)
//   node ecosysteme-voix.mjs --denise      forcer la voix de synthèse
//   node ecosysteme-voix.mjs --lister      afficher les voix du compte (nom + id)
//
// Si ElevenLabs est demandé mais indisponible, le script ÉCHOUE au lieu de
// retomber sur Denise : une vidéo présentée comme « avec votre voix » ne doit
// pas sortir avec une autre.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLE, VOIX, listerVoix, synthetiser } from './voix-elevenlabs.mjs';

if (process.argv.includes('--lister')) {
  if (!CLE) { console.error('ELEVENLABS_API_KEY absente de remotion/.env.local'); process.exit(1); }
  for (const v of await listerVoix()) console.log(`${v.id}  ${v.nom}  (${v.categorie})`);
  process.exit(0);
}

const moteur = process.argv.includes('--denise') ? 'denise' : CLE ? 'elevenlabs' : 'denise';
if (moteur === 'elevenlabs' && !VOIX) {
  console.error('ELEVENLABS_VOICE_ID absent de remotion/.env.local — lancer `node ecosysteme-voix.mjs --lister` pour le trouver.');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(new URL('./ecosysteme.json', import.meta.url), 'utf8'));
const dossier = fileURLToPath(new URL('./public/ecosysteme/', import.meta.url));
mkdirSync(dossier, { recursive: true });

console.log(`moteur de voix : ${moteur === 'elevenlabs' ? 'ElevenLabs (votre voix)' : 'edge-tts Denise'}`);
const durees = {};
for (const s of plan.scenes) {
  const mp3 = `${dossier}${s.id}.mp3`;
  if (moteur === 'elevenlabs') await synthetiser(s.voix, mp3);
  else execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+2%', '--text', s.voix, '--write-media', mp3], { stdio: 'pipe' });
  durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  console.log(`${s.id.padEnd(16)} ${durees[s.id].toFixed(2)} s`);
}
writeFileSync(`${dossier}durees.json`, JSON.stringify({ ...durees, _moteur: moteur }, null, 2));
console.log(`total ${Object.entries(durees).reduce((a, [, d]) => a + d, 0).toFixed(1)} s de voix`);
