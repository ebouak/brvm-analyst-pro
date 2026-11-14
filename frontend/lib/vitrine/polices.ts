import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';

/**
 * Polices du site (charte du 12/11/2026, §4) : Geist pour lire et titrer,
 * Instrument Serif italique pour souligner, Geist Mono pour compter.
 *
 * D'abord limitées à la page d'accueil (`.vitrine`), elles sont désormais posées
 * sur `<html>` par `app/layout.tsx` : `globals.css` fait pointer `--font-sans`,
 * `--font-display` et `--font-mono` sur ces variables, pour tout le site.
 * Geist et Geist Mono sont chargées en police variable (toutes les graisses dans
 * un seul fichier) : le site emploie du 400 au 700.
 */
export const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--vitrine-sans' });
export const geistMono = Geist_Mono({ subsets: ['latin'], display: 'swap', variable: '--vitrine-mono' });
export const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', display: 'swap', variable: '--vitrine-accent' });

/** Classes qui déclarent les variables de police (posées sur `<html>`). */
export const classesPolices = `${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
