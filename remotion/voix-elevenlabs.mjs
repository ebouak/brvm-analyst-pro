// Voix de l'auteur (clone ElevenLabs « jye ») — module partagé par les
// scripts de voix off de remotion/ (showreel, écosystème).
//
// La clé ne passe JAMAIS par le code ni par une conversation : variables
// d'environnement, ou remotion/.env.local (ignoré par git) :
//   ELEVENLABS_API_KEY=...
//   ELEVENLABS_VOICE_ID=...
//
// video/genere.mjs a sa propre copie de l'appel (paquet distinct, et un
// repli sur Denise que ces vidéos ponctuelles n'ont pas) — toute correction
// du format d'appel est à reporter là-bas.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const env = { ...process.env };
const fichierEnv = new URL('./.env.local', import.meta.url);
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !ligne.trimStart().startsWith('#')) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}

export const CLE = env.ELEVENLABS_API_KEY || '';
export const VOIX = env.ELEVENLABS_VOICE_ID || '';
export const configuree = Boolean(CLE && VOIX);
const API = 'https://api.elevenlabs.io/v1';

/** Liste les voix du compte (identifiant, nom, catégorie). */
export async function listerVoix() {
  const r = await fetch(`${API}/voices`, { headers: { 'xi-api-key': CLE } });
  if (!r.ok) throw new Error(`ElevenLabs /voices : ${r.status}`);
  return (await r.json()).voices.map((v) => ({ id: v.voice_id, nom: v.name, categorie: v.category }));
}

/** Synthétise `texte` avec la voix de l'auteur dans un MP3. Lève en cas d'échec. */
export async function synthetiser(texte, sortieMp3) {
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
  writeFileSync(sortieMp3, Buffer.from(await r.arrayBuffer()));
}
