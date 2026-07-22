/**
 * Narratif d'une valeur : squelette 100 % déterministe (chaque phrase dérive
 * d'une métrique) + garde-fou qui empêche toute reformulation LLM d'introduire
 * un chiffre absent des données. Règle §5 : rien d'inventé.
 */
import type { HebdoMetrics } from './types';

export interface Skeleton {
  sections: { titre: string; texte: string }[];
  /** TOUS les nombres autorisés dans la reformulation (whitelist du garde-fou). */
  chiffres: number[];
  verdict: string;
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)} %`;

export function buildSkeleton(m: HebdoMetrics): Skeleton {
  const sections: { titre: string; texte: string }[] = [];
  const chiffres: number[] = [m.dernier];

  // 1. Séance / semaine
  let s1 = `${m.code} termine la semaine à ${m.dernier} FCFA`;
  if (m.variationHebdo != null) {
    s1 += `, soit ${pct(m.variationHebdo)} sur la période`;
    chiffres.push(Math.abs(Math.round(m.variationHebdo * 100) / 100));
  }
  if (m.ratioVolume != null) {
    s1 += `, avec un volume ${m.ratioVolume.toFixed(1)}× la moyenne des 20 séances`;
    chiffres.push(Math.round(m.ratioVolume * 10) / 10);
  }
  sections.push({ titre: 'La semaine en un coup d’œil', texte: `${s1}.` });

  // 2. Momentum (RSI + MACD)
  if (m.rsiDernier != null) {
    chiffres.push(Math.round(m.rsiDernier * 10) / 10);
    const zone = m.rsiDernier > 70 ? 'en zone de surachat' : m.rsiDernier < 30 ? 'en zone de survente' : 'en zone neutre';
    const macd = m.macdPositif == null ? '' : m.macdPositif
      ? ' Le MACD est positif, ce qui soutient la dynamique en cours.'
      : ' Le MACD est négatif, ce qui pèse sur la dynamique.';
    sections.push({
      titre: 'Momentum',
      texte: `Le RSI(14) s’établit à ${m.rsiDernier.toFixed(1)}, ${zone}.${macd}`,
    });
  }

  // 3. Niveaux et cassure
  if (m.levels) {
    const l = m.levels;
    chiffres.push(l.resistance, l.support, l.objectif1, l.objectif2, l.invalidation);
    const etat = l.cassureHaut
      ? `Le cours a franchi la résistance des ${l.resistance} FCFA`
      : l.cassureBas
        ? `Le cours a rompu le support des ${l.support} FCFA`
        : `Le cours évolue entre ${l.support} et ${l.resistance} FCFA`;
    sections.push({
      titre: 'Niveaux à surveiller',
      texte: `${etat}. Support : ${l.support} FCFA. Premier objectif : ${l.objectif1} FCFA, second : ${l.objectif2} FCFA. Invalidation sous ${l.invalidation} FCFA.`,
    });
  }

  const verdict = m.variationHebdo != null && m.variationHebdo >= 0
    ? 'Dynamique haussière sur la semaine'
    : 'Repli sur la semaine';

  return { sections, chiffres: [...new Set(chiffres.map((x) => Math.round(x * 100) / 100))], verdict };
}

/**
 * Garde-fou : tout nombre présent dans `texte` doit figurer dans `chiffres`
 * (tolérance d'arrondi 1 %). Retourne false si le LLM a inventé une valeur.
 */
export function assertNoForeignNumber(texte: string, chiffres: number[]): boolean {
  const trouves = (texte.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
  return trouves.every((n) =>
    chiffres.some((c) => Math.abs(c - n) <= Math.max(0.5, Math.abs(c) * 0.01)),
  );
}
