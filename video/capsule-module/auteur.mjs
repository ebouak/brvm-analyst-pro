// Identité de l'auteur, gardée HORS du dépôt public (même règle que ../habillage/.gitignore).
//
// Les storyboards n'écrivent jamais le nom de l'auteur : ils portent des marqueurs
// {auteur.prenom}, {auteur.nomComplet}, {auteur.role}, résolus au chargement depuis
// le fichier LOCAL `auteur.json` (gitignoré), à côté de ce module :
//   { "prenom": "…", "nomComplet": "…", "role": "…" }
// Sa photo (logos/auteur.jpg) reste elle aussi hors du dépôt.
//
// La résolution se fait sur le texte brut du JSON, valeur échappée par
// JSON.stringify : une apostrophe ou un guillemet dans un nom ne casse rien.
// La même règle est reprise dans voix-edge.py (Python) : à corriger des deux côtés.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const AUTEUR_PATH = path.join(ICI, 'auteur.json');
const MARQUEUR = /\{auteur\.([A-Za-z]+)\}/g;

function chargerAuteur() {
  if (!fs.existsSync(AUTEUR_PATH)) {
    throw new Error(
      `Identité de l'auteur absente : ${AUTEUR_PATH}\n` +
        'Créez ce fichier, qui reste hors du dépôt : { "prenom": "…", "nomComplet": "…", "role": "…" }',
    );
  }
  return JSON.parse(fs.readFileSync(AUTEUR_PATH, 'utf8'));
}

/** Texte brut d'un storyboard, marqueurs {auteur.*} remplacés. Sans marqueur, inchangé. */
export function resoudreMarqueurs(brut) {
  if (!/\{auteur\.[A-Za-z]+\}/.test(brut)) return brut;
  const auteur = chargerAuteur();
  return brut.replace(MARQUEUR, (marqueur, champ) => {
    const valeur = auteur[champ];
    if (typeof valeur !== 'string' || !valeur.trim()) {
      throw new Error(`auteur.json : champ « ${champ} » manquant (marqueur ${marqueur}).`);
    }
    return JSON.stringify(valeur).slice(1, -1);
  });
}

/** Storyboard prêt à l'emploi : lu, marqueurs résolus, analysé. */
export function lirePlan(planPath) {
  return JSON.parse(resoudreMarqueurs(fs.readFileSync(planPath, 'utf8')));
}

/** Photos référencées par le plan et absentes du disque (portraits gardés hors du dépôt). */
export function photosAbsentes(plan) {
  const absentes = [];
  const visiter = (v) => {
    if (Array.isArray(v)) return v.forEach(visiter);
    if (!v || typeof v !== 'object') return;
    for (const [cle, x] of Object.entries(v)) {
      if (cle === 'photo' && typeof x === 'string') {
        if (!fs.existsSync(path.join(ICI, x))) absentes.push(x);
      } else visiter(x);
    }
  };
  visiter(plan);
  return [...new Set(absentes)];
}
