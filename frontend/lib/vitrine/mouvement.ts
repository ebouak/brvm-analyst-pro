// Logique pure des briques de mouvement de la vitrine (testée, sans React).

/** Frein fort : décélération quintique, 0 -> 1. */
export function frein(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 5);
}

/** Valeur du compteur à l'instant t (0..1). Exactement `arrivee` à t >= 1. */
export function valeurCompteur(depart: number, arrivee: number, t: number): number {
  if (!(t < 1)) return arrivee;
  if (!(t > 0)) return depart;
  return depart + (arrivee - depart) * frein(t);
}

export type TitreDecoupe = {
  /** Mots du titre hors accent, dans l'ordre. */
  principaux: string[];
  /** Mots du groupe d'accent (fin de titre), vide s'il n'y en a pas. */
  accentues: string[];
};

const mots = (s: string): string[] => s.split(/\s+/).filter(Boolean);

/**
 * Découpe un titre en mots. Si `accent` termine le texte, ses mots sont
 * séparés des autres ; sinon tout le titre est principal.
 */
export function decouperTitre(texte: string, accent?: string): TitreDecoupe {
  const t = texte.trim();
  const a = accent?.trim();
  if (a && t.endsWith(a)) {
    return { principaux: mots(t.slice(0, t.length - a.length)), accentues: mots(a) };
  }
  return { principaux: mots(t), accentues: [] };
}

export type SceneCourante = {
  index: number;
  /** Avancement dans la scène, 0..1. */
  progression: number;
  /** Avancement dans le cycle entier, 0..1. */
  progressionTotale: number;
};

export function dureeTotale(scenes: { duree: number }[]): number {
  return scenes.reduce((s, sc) => s + Math.max(0, sc.duree), 0);
}

/** Scène visible à l'instant tSecondes, avec bouclage. */
export function sceneA(scenes: { duree: number }[], tSecondes: number): SceneCourante {
  const total = dureeTotale(scenes);
  if (scenes.length === 0 || total <= 0 || !Number.isFinite(tSecondes)) {
    return { index: 0, progression: 0, progressionTotale: 0 };
  }
  const t = ((tSecondes % total) + total) % total;
  let cumul = 0;
  for (let i = 0; i < scenes.length; i++) {
    const d = Math.max(0, scenes[i].duree);
    if (t < cumul + d) {
      return { index: i, progression: d > 0 ? (t - cumul) / d : 0, progressionTotale: t / total };
    }
    cumul += d;
  }
  return { index: scenes.length - 1, progression: 1, progressionTotale: 1 };
}

/** Instant de début d'une scène (pour la navigation manuelle). */
export function debutScene(scenes: { duree: number }[], index: number): number {
  let c = 0;
  for (let i = 0; i < Math.min(index, scenes.length); i++) c += Math.max(0, scenes[i].duree);
  return c;
}
