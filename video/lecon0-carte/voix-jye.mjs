// Voix off de la leçon 0 : les enregistrements DÉJÀ FAITS avec la voix de
// l'auteur (clone ElevenLabs « jye », remotion/public/ecosysteme/*.mp3,
// texte = champ `voix` de remotion/ecosysteme.json, relu).
//   node voix-jye.mjs    -> video/out/lecon0-carte/voix-jye/<id>.mp3 + <id>.json
// Aucune nouvelle synthèse : on aligne chaque enregistrement sur son texte
// (alignement forcé ElevenLabs) pour obtenir le début et la fin de chaque mot,
// au même format que voix.py. Clés : remotion/.env.local, jamais ici.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLE } from '../../remotion/voix-elevenlabs.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const REMOTION = path.resolve(ICI, '../../remotion');
const OUT = path.resolve(ICI, '../out/lecon0-carte/voix-jye');
fs.mkdirSync(OUT, { recursive: true });
if (!CLE) throw new Error('ELEVENLABS_API_KEY absente (remotion/.env.local)');

const durees = JSON.parse(fs.readFileSync(path.join(REMOTION, 'public/ecosysteme/durees.json'), 'utf8'));
if (durees._moteur !== 'elevenlabs') throw new Error(`enregistrements produits par « ${durees._moteur} », pas par la voix de l'auteur`);
const plan = JSON.parse(fs.readFileSync(path.join(REMOTION, 'ecosysteme.json'), 'utf8'));

for (const s of plan.scenes) {
  const mp3 = path.join(REMOTION, 'public/ecosysteme', `${s.id}.mp3`);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), `${s.id}.mp3`);
  form.append('text', s.voix);
  const r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', { method: 'POST', headers: { 'xi-api-key': CLE }, body: form });
  if (!r.ok) throw new Error(`alignement ${s.id} : ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const mots = j.words
    .filter((w) => /[\p{L}\p{N}]/u.test(w.text))
    .map((w) => ({ m: w.text.trim(), a: +w.start.toFixed(3), b: +w.end.toFixed(3) }));
  fs.copyFileSync(mp3, path.join(OUT, `${s.id}.mp3`));
  fs.writeFileSync(path.join(OUT, `${s.id}.json`), JSON.stringify(mots));
  console.log(s.id.padEnd(16), mots.length, 'mots, fin', mots[mots.length - 1].b, '/', durees[s.id].toFixed(2), 's');
}
fs.writeFileSync(path.join(OUT, 'ordre.json'), JSON.stringify(plan.scenes.map((s) => s.id)));
