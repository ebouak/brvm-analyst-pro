import localFont from 'next/font/local';

/**
 * Polices du SEUL titre géant de l'accueil (`.v-ouverture`, 46 à 132 px).
 *
 * Pourquoi une instance à part. Le site charge Geist et Instrument Serif en
 * `display: swap` (`lib/vitrine/polices.ts`) : un texte s'affiche tout de suite
 * en police de repli, puis bascule à l'arrivée du fichier. À 132 px avec un
 * interlettrage de −0,055 em, cette bascule déplace le titre d'environ 150 px
 * (CLS 0,21 mesuré, polices retardées de 2,5 s, lot 7 étape 2).
 *
 * Ici `display: optional` : si le fichier n'est pas là au premier rendu (~100 ms
 * de blocage), le titre garde la police de repli ajustée (`size-adjust`,
 * `adjustFontFallback`) pour toute la visite, sans jamais basculer. La visite
 * suivante, le fichier est en cache et le titre sort en Geist.
 *
 * Pourquoi des fichiers locaux. Deux instances `next/font/google` de la même
 * famille portent le même nom de famille : le navigateur les fusionne et le
 * `swap` revient (essai mesuré à l'étape 2, 0,21 inchangé). `next/font/local`
 * donne un nom de famille propre à cette instance.
 *
 * `optional` n'est PAS posé globalement : le Dossier imprimé par le robot doit
 * garder sa police (une police de repli ferait déborder ses feuilles). Ces
 * fichiers ne servent qu'à l'accueil (préchargés sur `/` seulement).
 *
 * Fichiers : sous-ensemble latin de Google Fonts (Geist variable 100-900 v5,
 * Instrument Serif italique v5), licence SIL OFL 1.1 (`polices-titre/OFL-*.txt`).
 */
export const geistTitre = localFont({
  src: './polices-titre/Geist-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'optional',
  variable: '--titre-sans',
  adjustFontFallback: 'Arial',
});

export const instrumentTitre = localFont({
  src: './polices-titre/InstrumentSerif-Italic-latin.woff2',
  weight: '400',
  style: 'italic',
  display: 'optional',
  variable: '--titre-accent',
  adjustFontFallback: 'Times New Roman',
});

/** Classes qui déclarent `--titre-sans` et `--titre-accent` (posées sur le titre). */
export const classesPolicesTitre = `${geistTitre.variable} ${instrumentTitre.variable}`;
