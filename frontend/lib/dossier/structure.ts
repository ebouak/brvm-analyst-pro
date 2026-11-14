/**
 * Structure du dossier valeur : numéros de panneaux, nombre de feuilles, sommaire.
 *
 * UNE SEULE SOURCE. Le numéro d'un panneau est cité dans des textes (prose du
 * squelette, réserves, notes), le nombre de feuilles est vérifié par le worker
 * d'impression (`video/dossiers.mjs`, FEUILLES_ATTENDUES), et le sommaire
 * annonce la feuille de chaque section. Écrits en dur à trois endroits, ces
 * chiffres dérivent au premier panneau ajouté : c'est ce qui rendait les renvois
 * « panneau 12 » faux après chaque refonte.
 *
 * ⚠️ `TOTAL_FEUILLES` change AVEC la mise en page de `page.tsx` ET avec
 * FEUILLES_ATTENDUES de `video/dossiers.mjs` (le test `structure.test.ts` lit ce
 * fichier et échoue si les deux divergent).
 */

/** Rang de chaque panneau, dans l'ordre de lecture. */
export const PANNEAU = {
  entreprise: 1,
  chiffresCles: 2,
  trajectoire: 3,
  valorisation: 4,
  benefice: 5,
  dividende: 6,
  placement: 7,
  bandePer: 8,
  detachement: 9,
  cours: 10,
  appuis: 11,
  vigilance: 12,
  niveaux: 13,
  reaction: 14,
  titre: 15,
  intermediaire: 16,
  comparables: 17,
  piliers: 18,
  publications: 19,
  methode: 20,
} as const;

export const TOTAL_PANNEAUX = 20;

/**
 * Dix-sept feuilles : couverture (1), « L'essentiel » (2), lecture d'ensemble et
 * sommaire (3), puis trois sections ouvertes chacune par une page d'ouverture
 * (4, 9, 13) et leurs feuilles de contenu (5-8, 10-12, 14-17).
 */
export const TOTAL_FEUILLES = 17;

/** Sommaire : [titre, numéros des panneaux, feuille de départ]. */
export const SOMMAIRE: [string, string, number][] = [
  ['L’entreprise et ses chiffres clés', '01-02', 5],
  ['Trajectoire et valorisation', '03-04', 6],
  ['Origine du bénéfice et dividende', '05-06', 7],
  ['Un million de FCFA investi, valorisation sur cinq ans', '07-08', 8],
  ['Détachement, cours et niveaux', '09-10', 10],
  ['Points d’appui et de vigilance', '11-12', 11],
  ['Niveaux, réaction aux publications', '13-14', 12],
  ['Titre en bourse et dernière publication', '15-16', 14],
  ['Face aux sociétés comparables', '17', 15],
  ['Piliers de suivi et rendez-vous', '18', 16],
  ['Historique des publications, méthode et réserves', '19-20', 17],
];

/** « panneau 12 » : le renvoi écrit dans un texte, jamais saisi à la main. */
export const renvoi = (cle: keyof typeof PANNEAU): string => `panneau ${PANNEAU[cle]}`;
