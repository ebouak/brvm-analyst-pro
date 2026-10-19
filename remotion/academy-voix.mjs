// Voix off d'une leçon Academy : une piste par scène, puis le plan complet
// (sections, scènes, durées mesurées) dans public/academy/<lecon>/plan.json,
// que lit la composition academy-lecon. Copie aussi les logos référencés
// (frontend/public) dans public/academy/_assets, d'où la vidéo les lit.
//
// Même moteur que ecosysteme-voix.mjs : ElevenLabs (voix de l'auteur) dès que
// la clé est dans remotion/.env.local, sinon edge-tts Denise. Si ElevenLabs est
// demandé mais indisponible, le script échoue au lieu de changer de voix en
// silence. Une piste dont le texte et le moteur n'ont pas changé n'est pas
// régénérée (empreinte dans voix.json) : retoucher une phrase ne refacture
// pas toute la leçon.
//
// Usage :
//   node academy-voix.mjs n1-l1            moteur auto
//   node academy-voix.mjs n1-l1 --denise   forcer la voix de synthèse

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLE, VOIX, synthetiser } from './voix-elevenlabs.mjs';

const lecon = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!lecon || !/^[a-z0-9-]+$/.test(lecon)) {
  console.error('Usage : node academy-voix.mjs <lecon>   (ex. n1-l1)');
  process.exit(1);
}

const moteur = process.argv.includes('--denise') ? 'denise' : CLE ? 'elevenlabs' : 'denise';
if (moteur === 'elevenlabs' && !VOIX) {
  console.error('ELEVENLABS_VOICE_ID absent de remotion/.env.local — lancer `node ecosysteme-voix.mjs --lister`.');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(new URL(`./academy/${lecon}.json`, import.meta.url), 'utf8'));
const dossier = fileURLToPath(new URL(`./public/academy/${lecon}/`, import.meta.url));
mkdirSync(dossier, { recursive: true });

// Logos : tout champ « logo » / « logos » pointe vers frontend/public.
const sourcePublic = fileURLToPath(new URL('../frontend/public/', import.meta.url));
const assets = fileURLToPath(new URL('./public/academy/_assets/', import.meta.url));
const chemins = new Set();
JSON.stringify(plan, (k, v) => {
  if (k === 'logo' && typeof v === 'string') chemins.add(v);
  if (k === 'logos' && Array.isArray(v)) v.forEach((x) => chemins.add(x));
  return v;
});
for (const c of chemins) {
  if (!existsSync(sourcePublic + c)) { console.error(`logo introuvable : frontend/public/${c}`); process.exit(1); }
  mkdirSync(dirname(assets + c), { recursive: true });
  copyFileSync(sourcePublic + c, assets + c);
}
console.log(`${chemins.size} logos copiés`);

const empreintes = existsSync(`${dossier}voix.json`) ? JSON.parse(readFileSync(`${dossier}voix.json`, 'utf8')) : {};
const empreinteDe = (s) => createHash('sha256').update(`${moteur}\n${s.voix}`).digest('hex').slice(0, 16);

// Garde-fou de crédit : AVANT toute synthèse, on vérifie que le crédit
// ElevenLabs restant couvre toutes les pistes à (re)générer. Une leçon n'est
// jamais à moitié doublée : sinon elle mélangerait des scènes muettes ou une
// autre voix. Code de sortie 3 = crédit insuffisant (le lot s'arrête là).
if (moteur === 'elevenlabs') {
  const aFaire = plan.sections.flatMap((x) => x.scenes)
    .filter((s) => !(existsSync(`${dossier}${s.id}.mp3`) && empreintes[s.id] === empreinteDe(s)));
  const besoin = aFaire.reduce((a, s) => a + s.voix.length, 0);
  const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': CLE } });
  if (!r.ok) { console.error(`ElevenLabs /user/subscription : HTTP ${r.status}`); process.exit(1); }
  const sub = await r.json();
  const reste = sub.character_limit - sub.character_count;
  console.log(`crédit ElevenLabs : ${reste} caractères restants · besoin ${besoin}`);
  if (besoin > reste) {
    console.error(`Crédit insuffisant pour ${lecon} (${besoin} > ${reste}) : rien n'est généré. Renouvellement le ${new Date(sub.next_character_count_reset_unix * 1000).toISOString().slice(0, 10)}.`);
    process.exit(3);
  }
}
console.log(`leçon ${lecon} · moteur : ${moteur === 'elevenlabs' ? 'ElevenLabs (votre voix)' : 'edge-tts Denise'}`);
const durees = {};
for (const s of plan.sections.flatMap((x) => x.scenes)) {
  const mp3 = `${dossier}${s.id}.mp3`;
  const empreinte = empreinteDe(s);
  const neuf = !(existsSync(mp3) && empreintes[s.id] === empreinte);
  if (neuf) {
    if (moteur === 'elevenlabs') await synthetiser(s.voix, mp3);
    else execFileSync('python', ['-m', 'edge_tts', '--voice', plan.voixTts, '--rate', '+2%', '--text', s.voix, '--write-media', mp3], { stdio: 'pipe' });
    empreintes[s.id] = empreinte;
  }
  durees[s.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  console.log(`${s.id.padEnd(16)} ${durees[s.id].toFixed(2)} s${neuf ? '' : '  (inchangée)'}`);
}
writeFileSync(`${dossier}voix.json`, JSON.stringify(empreintes, null, 2));
writeFileSync(`${dossier}plan.json`, JSON.stringify({ ...plan, id: lecon, moteur, durees }, null, 2));
const total = Object.values(durees).reduce((a, d) => a + d, 0);
console.log(`total ${Math.floor(total / 60)} min ${Math.round(total % 60)} s de voix`);
