import { Easing, interpolate } from 'remotion';
import { MONO, SANS, SERIF } from '../polices';

/**
 * Les trois modèles de la vidéo de séance. Même récit, mêmes chiffres : seul
 * l'habillage change — fond, typographie, manière d'entrer en scène, et pour
 * certaines scènes la forme du graphique (barre / gaufre / carte de chaleur).
 *
 *  nuit     — terminal sombre, chiffres en chasse fixe, cyan de la marque
 *  papier   — une de journal claire, titres à empattements, encre et filets
 *  mosaique — carte du marché : chaque valeur est une tuile
 */
export type Modele = 'nuit' | 'papier' | 'mosaique';

export interface Theme {
  modele: Modele;
  fond: string;
  halo: string;          // dégradé de fond
  trame: string;         // motif de fond (lignes, grille)
  encre: string;         // texte principal
  doux: string;          // texte secondaire
  sourd: string;         // mentions
  accent: string;
  haut: string;
  bas: string;
  neutre: string;
  surface: string;
  bord: string;
  titre: string;         // famille des titres
  chiffre: string;       // famille des grands nombres
  texte: string;         // famille du corps
  casseTitre: 'none' | 'uppercase';
  entree: 'flou' | 'volet' | 'zoom';
  logoClair: boolean;    // trait du logo en clair (fond sombre) ou en encre
}

export const THEMES: Record<Modele, Theme> = {
  nuit: {
    modele: 'nuit',
    fond: '#030303',
    halo: 'radial-gradient(ellipse 110% 60% at 50% 28%, #0b2230 0%, #030303 64%)',
    trame: 'repeating-linear-gradient(to right, rgba(255,255,255,.035) 0 1px, transparent 1px 120px)',
    encre: '#FCFCFC', doux: '#A9BFC5', sourd: '#7A8A90',
    accent: '#56D7FD', haut: '#3fe18b', bas: '#ff6b6b', neutre: '#5b6f75',
    surface: '#0a1417', bord: 'rgba(255,255,255,.1)',
    titre: SERIF, chiffre: MONO, texte: SANS, casseTitre: 'none', entree: 'flou', logoClair: true,
  },
  papier: {
    modele: 'papier',
    fond: '#EEF2F1',
    halo: 'linear-gradient(180deg, #F4F7F6 0%, #E6ECEB 100%)',
    trame: 'repeating-linear-gradient(to bottom, rgba(11,20,23,.045) 0 1px, transparent 1px 64px)',
    encre: '#0B1417', doux: '#33454B', sourd: '#5E6F74',
    accent: '#0A6F7D', haut: '#0F7A46', bas: '#B8322B', neutre: '#93A2A6',
    surface: '#DDE6E4', bord: 'rgba(11,20,23,.16)',
    titre: SERIF, chiffre: SERIF, texte: SANS, casseTitre: 'none', entree: 'volet', logoClair: false,
  },
  mosaique: {
    modele: 'mosaique',
    fond: '#050A0C',
    halo: 'radial-gradient(ellipse 90% 50% at 50% 100%, #08262b 0%, #050A0C 70%)',
    trame:
      'repeating-linear-gradient(to right, rgba(86,215,253,.05) 0 1px, transparent 1px 90px),' +
      'repeating-linear-gradient(to bottom, rgba(86,215,253,.05) 0 1px, transparent 1px 90px)',
    encre: '#E9F4F6', doux: '#9FB6BC', sourd: '#62777D',
    accent: '#56D7FD', haut: '#2fd47e', bas: '#ff5d5d', neutre: '#34444a',
    surface: '#0b1518', bord: 'rgba(86,215,253,.16)',
    titre: MONO, chiffre: MONO, texte: SANS, casseTitre: 'uppercase', entree: 'zoom', logoClair: true,
  },
};

/* ── Mesure et formatage ──────────────────────────────────────────────── */

export const FPS = 30;
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Progression 0→1 entre deux images, bornée et adoucie. */
export const t = (f: number, a: number, b: number, de = 0, a2 = 1) =>
  interpolate(f, [a, b], [de, a2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

export const fr = (x: number, d = 2) =>
  x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** Variation signée ; une valeur qui s'arrondit à zéro n'a pas de signe (« +0,00 » mentirait). */
export const sg = (x: number, d = 2) =>
  Number(Math.abs(x).toFixed(d)) === 0 ? fr(0, d) : `${x >= 0 ? '+' : '−'}${fr(Math.abs(x), d)}`;
export const ton = (th: Theme, x: number) => (x > 0 ? th.haut : x < 0 ? th.bas : th.doux);

/** Couleur d'une tuile de la carte : intensité proportionnelle à la variation,
 *  saturée à ±7,5 % (amplitude maximale d'une séance BRVM courante). */
export function chaleur(th: Theme, v: number): string {
  if (Math.abs(v) < 0.005) return th.neutre;
  const a = Math.min(1, Math.abs(v) / 7.5);
  const base = v > 0 ? th.haut : th.bas;
  // mélange vers la surface : les petites variations restent sourdes
  return `color-mix(in oklab, ${base} ${Math.round(28 + a * 72)}%, ${th.surface})`;
}
