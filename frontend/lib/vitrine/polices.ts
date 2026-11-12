import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';

/**
 * Polices de la page d'accueil (charte du 12/11/2026, §4) : Geist pour lire,
 * Instrument Serif italique pour souligner, Geist Mono pour compter.
 * Limitées à la racine `.vitrine` : le reste du site garde Supreme / Bespoke
 * Serif jusqu'à la bascule globale (PR séparée).
 */
export const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--vitrine-sans' });
export const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--vitrine-mono' });
export const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', display: 'swap', variable: '--vitrine-accent' });

/** Classes à poser sur la racine `.vitrine` : elles déclarent les variables de police. */
export const classesPolices = `${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
