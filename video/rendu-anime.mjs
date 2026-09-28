// Bascule vers la vidéo animée (remotion/seance.tsx) — ou repli vers la fixe.
//
// Lancé APRÈS genere.mjs et le rendu Remotion, AVANT publie.mjs. Il ne publie
// rien : il décide seulement quel fichier `seance.json.fichier` désigne.
//
// La version animée n'est retenue que si TOUT est prouvé :
//   1. elle a été rendue à partir du MÊME seance.json (même séance, même texte
//      lu, même durée de voix) — sinon images et voix pourraient se contredire,
//      le défaut exact que ce worker existe pour empêcher ;
//   2. le fichier existe, pèse plus de 500 ko, porte une piste audio ;
//   3. il dure au moins autant que la voix (une vidéo coupée tronque la phrase).
// À défaut : la vidéo fixe de genere.mjs, mêmes chiffres, et le repli est
// ÉCRIT (rendu_raison) pour que la notification de l'exploitant le dise.
//
// Usage : node rendu-anime.mjs   (VIDEO_OUT comme genere.mjs)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.VIDEO_OUT || `${RACINE}/gan-harness/video`;
const FICHE = `${OUT}/seance.json`;
const ANIMEE = `${OUT}/westbourse-seance-anime.mp4`;
const RENDUE_DEPUIS = `${RACINE}/remotion/public/seance/seance.json`;

const m = JSON.parse(readFileSync(FICHE, 'utf8'));

function verifier() {
  if (!existsSync(RENDUE_DEPUIS)) return 'fiche du rendu absente';
  const r = JSON.parse(readFileSync(RENDUE_DEPUIS, 'utf8'));
  if (r.seance !== m.seance || r.texte !== m.texte || r.duree_s !== m.duree_s) {
    return 'rendu issu d’une autre lecture que la voix';
  }
  if (!existsSync(ANIMEE)) return 'fichier animé absent';
  if (statSync(ANIMEE).size < 500_000) return 'fichier animé trop léger';
  let sonde;
  try {
    sonde = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', ANIMEE,
    ]).toString());
  } catch {
    return 'fichier animé illisible';
  }
  if (!sonde.streams?.some((s) => s.codec_type === 'audio')) return 'pas de piste audio';
  if (Number(sonde.format?.duration) < m.duree_s) return 'vidéo plus courte que la voix';
  return null;
}

const raison = verifier();
const suite = raison
  ? { ...m, rendu: 'repli-ffmpeg', rendu_raison: raison }
  : { ...m, rendu: 'remotion', rendu_raison: null, fichier: ANIMEE };
writeFileSync(FICHE, JSON.stringify(suite, null, 2), 'utf8');

if (raison) {
  // Annotation visible sur la page du run, en plus de la notification du soir.
  console.log(`::warning title=Vidéo animée non retenue::${raison} — la version fixe sera publiée.`);
} else {
  console.log(`version animée retenue : ${ANIMEE}`);
}
