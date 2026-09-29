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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
const fichierEnv = new URL('./.env.local', import.meta.url);
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !ligne.trimStart().startsWith('#')) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
const CLE = env.ELEVENLABS_API_KEY;
const VOIX = env.ELEVENLABS_VOICE_ID;
const API = 'https://api.elevenlabs.io/v1';

if (process.argv.includes('--lister')) {
  if (!CLE) { console.error('ELEVENLABS_API_KEY absente de remotion/.env.local'); process.exit(1); }
  const r = await fetch(`${API}/voices`, { headers: { 'xi-api-key': CLE } });
  if (!r.ok) { console.error(`ElevenLabs /voices : ${r.status}`); process.exit(1); }
  const { voices } = await r.json();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  (${v.category})`);
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

async function elevenlabs(texte, sortie) {
  const r = await fetch(`${API}/text-to-speech/${VOIX}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': CLE, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texte,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} : ${(await r.text()).slice(0, 200)}`);
  writeFileSync(sortie, Buffer.from(await r.arrayBuffer()));
}

console.log(`moteur de voix : ${moteur === 'elevenlabs' ? 'ElevenLabs (votre voix)' : 'edge-tts Denise'}`);
const durees = {};
for (const s of plan.scenes) {
  const mp3 = `${dossier}${s.id}.mp3`;
  if (moteur === 'elevenlabs') await elevenlabs(s.voix, mp3);
  else execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+2%', '--text', s.voix, '--write-media', mp3], { stdio: 'pipe' });
  durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  console.log(`${s.id.padEnd(16)} ${durees[s.id].toFixed(2)} s`);
}
writeFileSync(`${dossier}durees.json`, JSON.stringify({ ...durees, _moteur: moteur }, null, 2));
console.log(`total ${Object.entries(durees).reduce((a, [, d]) => a + d, 0).toFixed(1)} s de voix`);
