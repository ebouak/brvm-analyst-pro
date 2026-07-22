/**
 * Narratif d'une valeur : squelette 100 % déterministe (chaque phrase dérive
 * d'une métrique) + garde-fou qui empêche toute reformulation LLM d'introduire
 * un chiffre absent des données. Règle §5 : rien d'inventé.
 */
import { fmtNombre, fmtPct, fmtRatio } from './format';
import type { HebdoMetrics, HebdoContexte } from './types';

export interface Skeleton {
  sections: { titre: string; texte: string }[];
  /** TOUS les nombres autorisés dans la reformulation (whitelist du garde-fou). */
  chiffres: number[];
  verdict: string;
}

/**
 * Constantes structurelles qui apparaissent LITTÉRALEMENT dans le texte du
 * squelette : « 20 dernières séances », l'indicateur de tension noté « sur
 * 100 » (échelle du RSI), et l'ancien repère « RSI(14) ». Sans elles dans la
 * whitelist, le garde-fou rejetterait même une reformulation parfaitement
 * fidèle (constaté au premier run réel : 100 % de rejets).
 */
const CONSTANTES_TEXTE = [14, 20, 100];

export function buildSkeleton(m: HebdoMetrics, ctx?: HebdoContexte): Skeleton {
  const sections: { titre: string; texte: string }[] = [];
  const chiffres: number[] = [m.dernier, ...CONSTANTES_TEXTE];

  // 1. Ce qui s'est passé — langage courant, chiffre en appui.
  let s1 = `${m.code} termine la semaine à ${fmtNombre(m.dernier)} FCFA`;
  if (m.variationHebdo != null) {
    const sens = m.variationHebdo >= 0 ? 'en hausse' : 'en repli';
    s1 += `, ${sens} de ${fmtPct(Math.abs(m.variationHebdo))} sur cinq séances`;
    chiffres.push(Math.abs(Math.round(m.variationHebdo * 100) / 100));
  }
  if (m.ratioVolume != null) {
    s1 += `. Il s’est échangé ${fmtRatio(m.ratioVolume)} fois plus de titres que d’habitude, ` +
          `signe que le mouvement a mobilisé du monde`;
    chiffres.push(Math.round(m.ratioVolume * 10) / 10);
  }
  sections.push({ titre: 'Ce qui s’est passé', texte: `${s1}.` });

  // 2. Ce que ça veut dire — on traduit, puis on chiffre.
  if (m.rsiDernier != null) {
    chiffres.push(Math.round(m.rsiDernier * 10) / 10);
    const lecture =
      m.rsiDernier > 70
        ? 'Le titre a beaucoup monté en peu de temps : il est en zone de surachat, ce qui appelle souvent une pause'
        : m.rsiDernier < 30
          ? 'Le titre a beaucoup baissé en peu de temps : il est en zone de survente, où des acheteurs reviennent parfois'
          : 'Le titre n’est ni suracheté ni survendu : la tension reste modérée';
    const macd = m.macdPositif == null ? '' : m.macdPositif
      ? ' La dynamique de fond reste orientée à la hausse.'
      : ' La dynamique de fond reste orientée à la baisse.';
    sections.push({
      titre: 'Ce que ça veut dire',
      texte: `${lecture} (indicateur de tension : ${fmtNombre(m.rsiDernier)} sur 100).${macd}`,
    });
  }

  // 3. Le contexte — uniquement si un éclairage existe (jamais de remplissage).
  const morceaux: string[] = [];
  if (ctx?.fondamental) { morceaux.push(ctx.fondamental.phrase); chiffres.push(...ctx.fondamental.chiffres); }
  if (ctx?.evenement) { morceaux.push(ctx.evenement.phrase); chiffres.push(...ctx.evenement.chiffres); }
  if (morceaux.length > 0) sections.push({ titre: 'Le contexte', texte: morceaux.join(' ') });

  // 4. Les niveaux à surveiller — directionnels, en langage courant.
  if (m.levels) {
    const l = m.levels;
    chiffres.push(l.resistance, l.support);
    let texte: string;
    if (l.cassureBas) {
      chiffres.push(l.objectifBas1, l.objectifBas2);
      texte =
        `Le cours est passé sous son plancher des 20 dernières séances (${fmtNombre(l.support)} FCFA), ` +
        `un seuil que les acheteurs défendaient jusqu’ici. Les prochains paliers à surveiller ` +
        `sont ${fmtNombre(l.objectifBas1)} puis ${fmtNombre(l.objectifBas2)} FCFA. Repasser durablement ` +
        `au-dessus de ${fmtNombre(l.support)} FCFA annulerait ce signal.`;
    } else if (l.cassureHaut) {
      chiffres.push(l.objectif1, l.objectif2, l.invalidation);
      texte =
        `Le cours a dépassé son plafond des 20 dernières séances (${fmtNombre(l.resistance)} FCFA), ` +
        `un seuil qui bloquait la hausse jusqu’ici. Les prochains paliers sont ${fmtNombre(l.objectif1)} ` +
        `puis ${fmtNombre(l.objectif2)} FCFA. Un retour sous ${fmtNombre(l.invalidation)} FCFA remettrait ` +
        `ce signal en cause.`;
    } else {
      texte =
        `Le cours reste coincé entre ${fmtNombre(l.support)} et ${fmtNombre(l.resistance)} FCFA. ` +
        `C’est la sortie de ce couloir qui donnera la direction : au-dessus de ${fmtNombre(l.resistance)} FCFA ` +
        `pour la hausse, sous ${fmtNombre(l.support)} FCFA pour la baisse.`;
    }
    sections.push({ titre: 'Les niveaux à surveiller', texte });
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
  // Les montants sont écrits à la française (« 3 050 FCFA ») : on recolle les
  // milliers avant d'extraire, sinon « 3 050 » se lirait « 3 » puis « 050 » et
  // le garde-fou rejetterait à tort un texte parfaitement fidèle.
  const normalise = texte.replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1');
  const trouves = (normalise.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
  return trouves.every((n) =>
    chiffres.some((c) => Math.abs(c - n) <= Math.max(0.5, Math.abs(c) * 0.01)),
  );
}

/**
 * Connecteurs qui affirment une CAUSE. Un texte d'analyse peut juxtaposer un
 * fait daté et un mouvement de cours ; il ne peut pas prétendre que l'un
 * explique l'autre — nous n'avons aucune donnée qui l'établisse.
 */
const CONNECTEURS_CAUSAUX = [
  'à cause de', 'a cause de',
  'en raison de',
  'suite à', 'suite a',
  'provoqué par', 'provoque par',
  'expliqué par', 'explique par',
  's’explique par', "s'explique par",
  'dû à', 'du à', 'due à',
  'sous l’effet de', "sous l'effet de",
  'grâce à', 'grace a',
  'porté par', 'porte par',
  'plombé par', 'plombe par',
];

/** false si le texte affirme un lien de causalité (→ on rejette la sortie LLM). */
export function assertNoCausalClaim(texte: string): boolean {
  const t = texte.toLowerCase();
  return !CONNECTEURS_CAUSAUX.some((c) => t.includes(c));
}
