/**
 * Série quotidienne de l'indice de nervosité BRVM-V, à partir des clôtures de
 * `brvm_actions_daily`. Logique PURE : aucune lecture de base, aucun réseau.
 *
 * La formule vit dans `pure/nervosite.ts` (copie du module fourni par
 * l'exploitant, identique à `frontend/lib/nervosite/nervosite.ts`) ; ce module
 * ne fait que préparer ses entrées et ranger ses sorties :
 *
 * 1. rendement log de chaque titre entre deux cotations successives
 *    (`rendementsLog` : les variations au-delà de ±8,5 % sont neutralisées) ;
 * 2. rendement du « marché large » d'une séance = moyenne simple des rendements
 *    des titres cotés ce jour-là (`rendementMarche`) ;
 * 3. série de l'indice (`serieNervosite`), puis rang de chaque valeur dans
 *    l'historique CONNU À CETTE DATE (fenêtre croissante, jamais de valeur
 *    future), et régime déduit de ce rang.
 */
import {
  rendementsLog, rendementMarche, serieNervosite, rangHistorique, regime, type Regime,
} from './pure/nervosite.js';

/**
 * Début de la série. Avant 2007, la base ne porte qu'un titre et demi par
 * séance en moyenne (mesuré le 2026-11-16 : 1,1 à 1,5 de 1998 à 2006, 10,7 en
 * 2007) : une « moyenne du marché » sur un seul titre n'en serait pas une.
 */
export const DEBUT_SERIE = '2007-01-01';

/**
 * Une séance où moins de 5 titres ont un rendement est écartée de la série
 * (39 séances sur 5 017 depuis 2007, mesuré le 2026-11-16). Elle n'est pas comptée
 * comme une séance calme : elle n'existe pas pour l'indice.
 */
export const MIN_TITRES = 5;

/**
 * Pas de rang (donc pas de régime) tant que l'indice n'a pas un an de valeurs
 * derrière lui : classer une valeur parmi trois autres ne dirait rien.
 */
export const MIN_HISTORIQUE_RANG = 250;

export interface CoursLigne {
  code: string;
  date_marche: string;
  cours_jour: number | null;
}

export interface LigneNervosite {
  date_marche: string;
  /** Indice, % annualisé. `null` tant que l'historique est insuffisant. */
  valeur: number | null;
  rapide: number | null;
  lente: number | null;
  /** Rang 0-100 de `valeur` parmi les valeurs connues jusqu'à cette séance incluse. */
  rang: number | null;
  regime: Regime | null;
  /** Nombre de titres dont le rendement entre dans la moyenne de la séance. */
  n_titres: number;
}

export interface RendementSeance {
  date_marche: string;
  rendement: number;
  n_titres: number;
}

/** Rendement du marché large, séance par séance, triées par date croissante. */
export function rendementsParSeance(lignes: readonly CoursLigne[], debut = DEBUT_SERIE): RendementSeance[] {
  const parCode = new Map<string, { date: string; cours: number }[]>();
  for (const l of lignes) {
    if (l.date_marche < debut) continue;
    const c = l.cours_jour == null ? NaN : Number(l.cours_jour);
    // Un cours nul ou absent est un trou de collecte, pas un cours : la ligne
    // est ignorée et le rendement suivant se calcule depuis la cotation d'avant.
    if (!(c > 0) || !Number.isFinite(c)) continue;
    let liste = parCode.get(l.code);
    if (!liste) parCode.set(l.code, (liste = []));
    liste.push({ date: l.date_marche, cours: c });
  }

  const parDate = new Map<string, number[]>();
  for (const liste of parCode.values()) {
    liste.sort((a, b) => a.date.localeCompare(b.date));
    // Une date en double pour un même titre ne doit pas produire un faux rendement nul.
    const uniques = liste.filter((x, i) => i === 0 || x.date !== liste[i - 1]!.date);
    const r = rendementsLog(uniques.map((x) => x.cours));
    for (let i = 0; i < r.length; i++) {
      const d = uniques[i + 1]!.date;
      let jour = parDate.get(d);
      if (!jour) parDate.set(d, (jour = []));
      jour.push(r[i]!);
    }
  }

  return [...parDate.entries()]
    .filter(([, rs]) => rs.length >= MIN_TITRES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date_marche, rs]) => ({ date_marche, rendement: rendementMarche(rs), n_titres: rs.length }));
}

const arrondi = (x: number | null) => (x == null ? null : Math.round(x * 10_000) / 10_000);

/** Série complète, une ligne par séance retenue. */
export function construireSerie(lignes: readonly CoursLigne[], debut = DEBUT_SERIE): LigneNervosite[] {
  const seances = rendementsParSeance(lignes, debut);
  const points = serieNervosite(seances.map((s) => s.rendement));
  const historique: number[] = [];
  return seances.map((s, i) => {
    const p = points[i]!;
    let rang: number | null = null;
    if (p.valeur !== null) {
      historique.push(p.valeur);
      // Garde-fou : `regime(NaN)` vaudrait « tendu » ; on ne l'appelle donc
      // jamais sans un rang calculé sur un historique suffisant.
      if (historique.length >= MIN_HISTORIQUE_RANG) rang = rangHistorique(p.valeur, historique);
    }
    return {
      date_marche: s.date_marche,
      valeur: arrondi(p.valeur),
      rapide: arrondi(p.rapide),
      lente: arrondi(p.lente),
      rang: rang === null ? null : Math.round(rang * 100) / 100,
      regime: rang === null ? null : regime(rang),
      n_titres: s.n_titres,
    };
  });
}
