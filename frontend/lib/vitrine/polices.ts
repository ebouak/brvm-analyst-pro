import localFont from 'next/font/local';

/**
 * Polices du site (charte du 12/11/2026, §4) : Geist pour lire et titrer,
 * Instrument Serif italique pour souligner, Geist Mono pour compter.
 *
 * D'abord limitées à la page d'accueil (`.vitrine`), elles sont désormais posées
 * sur `<html>` par `app/layout.tsx` : `globals.css` fait pointer `--font-sans`,
 * `--font-display` et `--font-mono` sur ces variables, pour tout le site.
 * Geist et Geist Mono sont chargées en police variable (toutes les graisses dans
 * un seul fichier) : le site emploie du 400 au 700.
 *
 * Fichiers LOCAUX (sous-ensemble latin, WOFF2, licence OFL dans
 * `polices-titre/`), et non `next/font/google`, pour deux raisons :
 * 1. ce sont les MÊMES fichiers que `policesTitre.ts` : la page d'accueil
 *    téléchargeait Geist deux fois (une copie Google, une copie locale) ;
 *    désormais une seule URL, donc un seul téléchargement ;
 * 2. le build ne dépend plus de fonts.googleapis.com (il échouait hors réseau).
 * Le sous-ensemble latin couvre le français (é, œ, ’, «  », €), vérifié.
 */
export const geist = localFont({
  src: './polices-titre/Geist-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--vitrine-sans',
  adjustFontFallback: 'Arial',
});

export const geistMono = localFont({
  src: './polices-titre/GeistMono-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--vitrine-mono',
  // Le mono n'apparaît pas au-dessus de la ligne de flottaison en grand corps :
  // pas de préchargement, il arrive avec les chiffres.
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});

export const instrumentSerif = localFont({
  src: './polices-titre/InstrumentSerif-Italic-latin.woff2',
  weight: '400',
  style: 'italic',
  display: 'swap',
  variable: '--vitrine-accent',
  adjustFontFallback: 'Times New Roman',
});

/** Classes qui déclarent les variables de police (posées sur `<html>`). */
export const classesPolices = `${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
