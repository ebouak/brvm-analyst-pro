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

/**
 * Constantes structurelles qui apparaissent LITTÉRALEMENT dans le texte du
 * squelette : « RSI(14) » et « moyenne des 20 séances ». Sans elles dans la
 * whitelist, le garde-fou rejetterait même une reformulation parfaitement
 * fidèle (constaté au premier run réel : 100 % de rejets).
 */
const CONSTANTES_TEXTE = [14, 20];

export function buildSkeleton(m: HebdoMetrics): Skeleton {
  const sections: { titre: string; texte: string }[] = [];
  const chiffres: number[] = [m.dernier, ...CONSTANTES_TEXTE];

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

  // 3. Niveaux et cassure — DIRECTIONNEL : on ne présente jamais d'objectif
  //    haussier à une valeur qui vient de rompre son support (et inversement).
  if (m.levels) {
    const l = m.levels;
    chiffres.push(l.resistance, l.support);
    let texte: string;
    if (l.cassureBas) {
      chiffres.push(l.objectifBas1, l.objectifBas2);
      texte =
        `Le cours a rompu le support des ${l.support} FCFA. ` +
        `Prochains seuils à la baisse : ${l.objectifBas1} FCFA, puis ${l.objectifBas2} FCFA. ` +
        `Un retour durable au-dessus de ${l.support} FCFA annulerait cette rupture.`;
    } else if (l.cassureHaut) {
      chiffres.push(l.objectif1, l.objectif2, l.invalidation);
      texte =
        `Le cours a franchi la résistance des ${l.resistance} FCFA. ` +
        `Premier objectif : ${l.objectif1} FCFA, second : ${l.objectif2} FCFA. ` +
        `Invalidation sous ${l.invalidation} FCFA.`;
    } else {
      texte =
        `Le cours évolue entre ${l.support} et ${l.resistance} FCFA. ` +
        `Une sortie de ce canal donnera la direction : au-dessus de ${l.resistance} FCFA à la hausse, ` +
        `sous ${l.support} FCFA à la baisse.`;
    }
    sections.push({ titre: 'Niveaux à surveiller', texte });
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
