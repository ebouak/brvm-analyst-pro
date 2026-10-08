// Prépare le rendu animé de la vidéo de séance (seance.tsx).
//
// NE LIT PAS LA BASE. Tout vient de ce qu'a produit video/genere.mjs — une
// seule lecture de Supabase, dont sont tirés à la fois la voix, les images et
// la légende publiée. Relire la base ici ouvrirait une seconde chance de se
// contredire (la voix avait annoncé 31 hausses quand l'écran en montrait 18).
//
// Usage : node seance-prep.mjs <dossier de sortie de genere.mjs>
//   → public/seance/seance.json, voix.mp3, logos/<CODE>.<ext>

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ICI = fileURLToPath(new URL('.', import.meta.url));
const RACINE = resolve(ICI, '..');
const SOURCE = process.argv[2] || process.env.VIDEO_OUT || `${RACINE}/gan-harness/video`;
const CIBLE = `${ICI}public/seance`;

const fiche = JSON.parse(readFileSync(`${SOURCE}/seance.json`, 'utf8'));
if (!fiche.video) {
  console.error('seance.json sans bloc « video » : relancer video/genere.mjs (version à jour).');
  process.exit(1);
}

rmSync(CIBLE, { recursive: true, force: true });
mkdirSync(`${CIBLE}/logos`, { recursive: true });
copyFileSync(`${SOURCE}/voix.mp3`, `${CIBLE}/voix.mp3`);

/* Un logo n'est utilisé que s'il existe : jamais celui d'une autre société.
   Sans fichier, la scène affiche le code (même règle que genere.mjs). */
const codes = new Set([
  ...fiche.video.frise,
  fiche.ligne_lourde.code,
  fiche.plus_forte_hausse.code,
  fiche.plus_forte_baisse.code,
  // les modèles affichent aussi le palmarès complet et les plus échangées
  ...(fiche.video.meilleures ?? []).map((m) => m.code),
  ...(fiche.video.pires ?? []).map((m) => m.code),
  ...[...(fiche.video.cotes ?? [])].sort((a, b) => b.part_pct - a.part_pct).slice(0, 8).map((c) => c.code),
]);
const logos = {};
for (const code of codes) {
  for (const ext of ['png', 'jpg', 'jpeg', 'gif']) {
    const f = `${RACINE}/frontend/public/logos/${code}.${ext}`;
    if (existsSync(f)) {
      copyFileSync(f, `${CIBLE}/logos/${code}.${ext}`);
      logos[code] = `seance/logos/${code}.${ext}`;
      break;
    }
  }
}

writeFileSync(`${CIBLE}/seance.json`, JSON.stringify({ ...fiche, logos }, null, 2));
console.log(
  `séance ${fiche.seance} · voix ${fiche.duree_s.toFixed(1)} s · ${Object.keys(logos).length}/${codes.size} logos` +
    (fiche.publiable ? '' : ' · ⚠ SÉANCE NON PUBLIABLE'),
);
