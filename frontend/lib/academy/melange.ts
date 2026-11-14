import type { Qcm } from './types';

/**
 * Ordre d'affichage des options d'un quiz de leçon — module PUR et testé.
 *
 * Relecture du 2026-11-14 : la bonne réponse était l'option B dans 82 % des
 * 169 questions ; un lecteur pouvait réussir sans lire. Les options sont donc
 * permutées, mais de façon DÉTERMINISTE (graine = texte de la question) : le
 * même ordre au rendu serveur et au client (pas d'écart d'hydratation), et d'un
 * passage à l'autre. La bonne réponse suit la permutation : on corrige toujours
 * par la valeur, jamais par la position d'origine.
 */

/** Empreinte 32 bits (FNV-1a) d'une chaîne. */
function empreinte(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire (mulberry32) à graine fixe. */
function generateur(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Permutation de Fisher-Yates : `ordre[k]` = indice d'origine affiché en position k. */
export function ordreOptions(question: string, n: number): number[] {
  const ordre = Array.from({ length: n }, (_, i) => i);
  const alea = generateur(empreinte(question));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j]!, ordre[i]!];
  }
  return ordre;
}

/** Le même QCM, options permutées et `correct` recalculé sur le nouvel ordre. */
export function melangerQcm<Q extends Pick<Qcm, 'question' | 'options' | 'correct'>>(q: Q): Q {
  const ordre = ordreOptions(q.question, q.options.length);
  return { ...q, options: ordre.map((i) => q.options[i]!), correct: ordre.indexOf(q.correct) };
}
