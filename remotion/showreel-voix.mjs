// Voix off du showreel : une piste par phrase, avec la voix de l'auteur
// (ElevenLabs « jye », voir voix-elevenlabs.mjs) dès qu'elle est configurée,
// sinon edge-tts Denise ; convertie en WAV 44,1 kHz mono pour le mixage de
// showreel-audio.mjs. `--denise` force la voix de synthèse.
//
// Vérifie que chaque phrase TIENT dans sa fenêtre : de son décalage jusqu'à la
// phrase suivante (ou la fin de sa scène). Une phrase trop longue fait échouer
// le script plutôt que d'être coupée ou de chevaucher la suivante.
//
// Usage : node showreel-voix.mjs  →  public/voix/<id>.wav + durees.json

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configuree, synthetiser } from './voix-elevenlabs.mjs';

const plan = JSON.parse(readFileSync(new URL('./showreel-plan.json', import.meta.url), 'utf8'));
const dossier = fileURLToPath(new URL('./public/voix/', import.meta.url));
mkdirSync(dossier, { recursive: true });

const FPS = 30;
const debutScene = {};
let cumul = 0;
for (const s of plan.scenes) { debutScene[s.id] = cumul; cumul += s.duree; }
const finScene = (id) => debutScene[id] + plan.scenes.find((s) => s.id === id).duree;

const durees = {};
const trop = [];
const auteur = configuree && !process.argv.includes('--denise');
console.log(`voix : ${auteur ? "auteur (ElevenLabs)" : 'Denise (edge-tts)'}`);
for (const [i, v] of plan.voix.entries()) {
  const mp3 = `${dossier}${v.id}.mp3`, wav = `${dossier}${v.id}.wav`;
  if (auteur) await synthetiser(v.texte, mp3);
  else execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+4%', '--text', v.texte, '--write-media', mp3], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '44100', '-ac', '1', wav]);
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString());
  durees[v.id] = d;
  const debut = debutScene[v.scene] + v.decalage;
  const suivante = plan.voix[i + 1];
  const limite = suivante ? debutScene[suivante.scene] + suivante.decalage : finScene(v.scene);
  const marge = (limite - debut) / FPS - d;
  console.log(`${v.id} ${d.toFixed(2)} s  fenêtre ${((limite - debut) / FPS).toFixed(2)} s  marge ${marge.toFixed(2)} s`);
  if (marge < 0.3) trop.push(v.id);
}

writeFileSync(`${dossier}durees.json`, JSON.stringify(durees, null, 2));
if (trop.length) {
  console.error(`Phrases trop longues pour leur fenêtre : ${trop.join(', ')}`);
  process.exit(1);
}
