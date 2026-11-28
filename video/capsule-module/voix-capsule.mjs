// Voix off d'une capsule Module Academy via ElevenLabs (solo ou format Podcast 2 voix).
//   node video/capsule-module/voix-capsule.mjs n1-m1
//   node video/capsule-module/voix-capsule.mjs n1-m2
//   node video/capsule-module/voix-capsule.mjs n1-m1 --fallback-el
//
// Lit `ELEVENLABS_VOICE_ID` (voix `WESTBOURSE`) pour l'expert et, lorsque
// `plan.intervenants?.journaliste` existe, résout la voix de la journaliste
// (voix déjà présente sur le compte, ajout depuis la Shared Voice Library, ou
// repli automatique vers `fallbackVoiceId`).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLE, VOIX, configuree } from '../../remotion/voix-elevenlabs.mjs';
import { lirePlan } from './auteur.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const fallbackEl = args.includes('--fallback-el');
const AMADOU_ID = '8R6pzcy1HIr4WcoApmzw';

if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage : node video/capsule-module/voix-capsule.mjs <id> [--fallback-el]');
  process.exit(1);
}
if (!configuree) {
  console.error('ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID absente dans remotion/.env.local');
  process.exit(1);
}

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = path.join(ICI, 'capsules', `${id}.json`);
if (!fs.existsSync(PLAN_PATH)) {
  console.error(`Storyboard introuvable : ${PLAN_PATH}`);
  process.exit(1);
}
// Marqueurs {auteur.*} résolus avant synthèse : la voix prononce le nom, le dépôt ne le contient pas.
const plan = lirePlan(PLAN_PATH);

const segments = [{ id: 'hook', texte: plan.hook.voix, speaker: plan.hook.speaker || 'expert' }];
for (const e of plan.etapes) {
  if (e.question?.voix) {
    segments.push({ id: `${e.id}_q`, texte: e.question.voix, speaker: 'journaliste' });
  }
  segments.push({ id: e.id, texte: e.voix, speaker: e.speaker || 'expert' });
}
segments.push({ id: 'fin', texte: plan.fin.voix, speaker: plan.fin.speaker || 'expert' });

async function ttsElevenLabs(voiceId, texte, outMp3, speaker = 'expert') {
  const settings = speaker === 'journaliste'
    ? { stability: 0.45, similarity_boost: 0.80, style: 0.25, speed: 1.03, use_speaker_boost: true }
    : { stability: 0.34, similarity_boost: 0.82, style: 0.48, speed: 1.07, use_speaker_boost: true };
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': CLE, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texte,
      model_id: 'eleven_multilingual_v2',
      voice_settings: settings,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    const err = new Error(`ElevenLabs ${r.status} : ${body.slice(0, 260)}`);
    err.status = r.status;
    err.body = body;
    throw err;
  }
  fs.writeFileSync(outMp3, Buffer.from(await r.arrayBuffer()));
}

function fallbackTimings(texte, duree) {
  const words = texte.split(/\s+/).filter(Boolean);
  if (!words.length) return [{ m: '...', a: 0, b: Math.max(0.5, duree) }];
  const weights = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, '').length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let cur = 0.05;
  const usable = Math.max(0.3, duree - 0.1);
  return words.map((w, i) => {
    const dt = (weights[i] / sum) * usable;
    const row = { m: w, a: +cur.toFixed(3), b: +(cur + dt).toFixed(3) };
    cur += dt;
    return row;
  });
}

async function aligner(mp3Path, texte, duree) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(mp3Path)], { type: 'audio/mpeg' }), path.basename(mp3Path));
  form.append('text', texte);
  const r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: { 'xi-api-key': CLE },
    body: form,
  });
  if (!r.ok) {
    console.warn(`  [warn] forced-alignment ${r.status} → repli proportionnel`);
    return fallbackTimings(texte, duree);
  }
  const j = await r.json();
  const mots = (j.words ?? [])
    .filter((w) => /[\p{L}\p{N}]/u.test(w.text))
    .map((w) => ({ m: w.text.trim(), a: +w.start.toFixed(3), b: +w.end.toFixed(3) }));
  return mots.length ? mots : fallbackTimings(texte, duree);
}

async function resoudreVoixJournaliste(cfg) {
  if (!cfg?.voiceId) return null;
  try {
    const existing = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': CLE } }).then((r) => r.json());
    if ((existing.voices ?? []).some((v) => v.voice_id === cfg.voiceId)) {
      return cfg.voiceId;
    }
    if (cfg.publicOwnerId) {
      const addRes = await fetch(`https://api.elevenlabs.io/v1/voices/add/${cfg.publicOwnerId}/${cfg.voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': CLE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: 'Amina - Journaliste WestBourse' }),
      });
      if (addRes.ok) {
        const added = await addRes.json().catch(() => ({}));
        console.log(`[ElevenLabs] Voix journaliste ajoutée au compte (${added.voice_id || cfg.voiceId}).`);
        return added.voice_id || cfg.voiceId;
      }
      const errTxt = await addRes.text().catch(() => '');
      console.warn(`[ElevenLabs] Ajout voix bibliothèque impossible (${addRes.status} ${errTxt.slice(0, 120)}) → repli.`);
    }
  } catch (e) {
    console.warn(`[ElevenLabs] Résolution voix journaliste : ${e.message}`);
  }
  return cfg.fallbackVoiceId || 'EXAVITQu4vr4xnSDxMaL';
}

let activeVoiceId = VOIX;
let voiceFolder = 'voix-jye';
let voiceLabel = `WESTBOURSE (${VOIX})`;

try {
  const sub = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': CLE } }).then((r) => r.json());
  if (sub && sub.can_use_instant_voice_cloning === false) {
    console.warn(`[ElevenLabs] tier=${sub.tier}, can_use_instant_voice_cloning=false → le clone vocal nécessite un forfait Starter/Creator.`);
    if (!fallbackEl) process.exit(2);
    activeVoiceId = AMADOU_ID;
    voiceFolder = 'voix-amadou';
    voiceLabel = `Amadou - Bright and Articulate (${AMADOU_ID})`;
  }
} catch { /* continuer et tester la synthèse directe */ }

const besoinJournaliste = segments.some((s) => s.speaker === 'journaliste');
const journalistVoiceId = besoinJournaliste ? await resoudreVoixJournaliste(plan.intervenants?.journaliste) : null;

const OUT = path.resolve(ICI, '../out/capsule-module', id, voiceFolder);
fs.mkdirSync(OUT, { recursive: true });
const empFile = path.join(OUT, 'empreintes.json');
const empreintes = fs.existsSync(empFile) ? JSON.parse(fs.readFileSync(empFile, 'utf8')) : {};

console.log(`Capsule ${id} · ElevenLabs → ${voiceLabel}${journalistVoiceId ? ` + Journaliste (${journalistVoiceId})` : ''} (dossier: ${voiceFolder})`);

let totalSec = 0;
const speakerMap = {};
for (const seg of segments) {
  const vid = seg.speaker === 'journaliste' && journalistVoiceId ? journalistVoiceId : activeVoiceId;
  speakerMap[seg.id] = seg.speaker;
  const mp3 = path.join(OUT, `${seg.id}.mp3`);
  const tim = path.join(OUT, `${seg.id}.json`);
  const hash = createHash('sha256').update(`${vid}\n${seg.speaker}\n${seg.texte}`).digest('hex').slice(0, 16);
  const reuse = fs.existsSync(mp3) && fs.existsSync(tim) && empreintes[seg.id] === hash;

  if (!reuse) {
    await ttsElevenLabs(vid, seg.texte, mp3, seg.speaker);
  }
  const duree = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3])
      .toString()
      .trim(),
  );
  let mots;
  if (!reuse) {
    mots = await aligner(mp3, seg.texte, duree);
    fs.writeFileSync(tim, JSON.stringify(mots));
    empreintes[seg.id] = hash;
  } else {
    mots = JSON.parse(fs.readFileSync(tim, 'utf8'));
  }
  totalSec += duree;
  const tag = seg.speaker === 'journaliste' ? '[J]' : '[E]';
  console.log(`  ${tag} ${seg.id.padEnd(13)} ${duree.toFixed(2)}s · ${String(mots.length).padStart(3)} mots${reuse ? '  (cache)' : ''}`);
}

fs.writeFileSync(empFile, JSON.stringify(empreintes, null, 2));
fs.writeFileSync(path.join(OUT, 'ordre.json'), JSON.stringify(segments.map((s) => s.id)));
fs.writeFileSync(path.join(OUT, 'speakers.json'), JSON.stringify(speakerMap, null, 2));
console.log(`Total voix : ${totalSec.toFixed(1)} s → ${OUT}`);
