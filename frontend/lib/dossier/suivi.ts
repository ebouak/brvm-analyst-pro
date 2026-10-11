/**
 * Suivi d'une valeur — module PUR et testé (suivi.test.mjs).
 *
 * Trois lectures factuelles pour le dossier valeur, aucune recommandation :
 *  (la comparaison intermédiaire à périmètre égal n'est PAS ici : elle existe
 *  déjà, testée, dans `lib/financials/interim.ts` — `lectureIntermediaire`) ;
 *  - la performance du titre : un mois, depuis le 1er janvier, position dans
 *    la plage de 52 semaines ;
 *  - des « piliers » mesurés : chacun porte sa mesure, un SEUIL écrit en clair
 *    et un statut (seuil atteint / non atteint / non mesurable). Le seuil est
 *    une référence de lecture, pas un objectif ni un conseil ;
 *  - le contrôle d'une ex-date : une baisse du cours très inférieure au
 *    dividende le jour du détachement signale une date à vérifier.
 *
 * RÈGLE : une donnée absente donne `null` / « non mesurable », jamais 0 ni un
 * statut favorable par défaut.
 */
import { BAREME, PAYS_LABELS, toPaysUemoa } from '@/lib/tax/rates';

// ── Performance du titre ────────────────────────────────────────────────────

const variation = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : (a - b) / Math.abs(b));

export interface PerformanceTitre {
  var_1m: number | null;
  var_ytd: number | null;
  /** 0 = au plus-bas 52 semaines, 1 = au plus-haut. */
  position_52s: number | null;
  haut52: number | null;
  bas52: number | null;
}

/** `closes` : clôtures réelles, de la plus ancienne à la plus récente. */
export function performanceTitre(e: {
  closes: number[];
  coursDebutAnnee: number | null;
  haut52: number | null;
  bas52: number | null;
}): PerformanceTitre {
  const n = e.closes.length;
  const dernier = n ? e.closes[n - 1] : null;
  const ilYaUnMois = n > 21 ? e.closes[n - 1 - 21] : null; // ~21 séances par mois
  const etendue = e.haut52 != null && e.bas52 != null ? e.haut52 - e.bas52 : null;
  return {
    var_1m: variation(dernier, ilYaUnMois),
    var_ytd: variation(dernier, e.coursDebutAnnee),
    position_52s: dernier != null && etendue != null && etendue > 0 ? (dernier - e.bas52!) / etendue : null,
    haut52: e.haut52,
    bas52: e.bas52,
  };
}

// ── Piliers mesurés ─────────────────────────────────────────────────────────

export type StatutPilier = 'tenu' | 'non_tenu' | 'non_mesurable' | 'non_applicable';
export type Tendance = 'hausse' | 'baisse' | 'stable' | null;

export interface Pilier {
  cle: 'croissance' | 'marge' | 'rentabilite' | 'endettement' | 'dividende' | 'valorisation';
  libelle: string;
  mesure: number | null;
  unite: '%' | 'x' | 'FCFA';
  precedente: number | null;
  tendance: Tendance;
  /** Le seuil de lecture, en clair. Une référence, pas un objectif. */
  seuil: string;
  statut: StatutPilier;
}

export interface EntreePiliers {
  famille: 'banque' | 'assurance' | 'general';
  croissanceCA: number | null;
  margeExp: number | null;
  margeExpPrecedente: number | null;
  roe: number | null;
  endettement: number | null;
  /** Dividendes par exercice, du plus ancien au plus récent, zéros compris. */
  dividendes: number[];
  per: number | null;
  perMediane: number | null;
}

const tendance = (a: number | null, b: number | null, tolerance: number): Tendance =>
  a == null || b == null ? null : a - b > tolerance ? 'hausse' : b - a > tolerance ? 'baisse' : 'stable';

const statut = (mesurable: boolean, atteint: boolean): StatutPilier =>
  !mesurable ? 'non_mesurable' : atteint ? 'tenu' : 'non_tenu';

export function piliersThese(e: EntreePiliers): Pilier[] {
  const divs = e.dividendes.filter((d) => Number.isFinite(d));
  const divBaisse = divs.some((d, i) => i > 0 && d < divs[i - 1]);
  const margeTend = tendance(e.margeExp, e.margeExpPrecedente, 0.01);
  return [
    {
      cle: 'croissance', libelle: 'Croissance du chiffre d’affaires', unite: '%',
      mesure: e.croissanceCA, precedente: null, tendance: null,
      seuil: 'Chiffre d’affaires du dernier exercice en hausse sur un an.',
      statut: statut(e.croissanceCA != null, (e.croissanceCA ?? 0) > 0),
    },
    {
      cle: 'marge', libelle: 'Marge d’exploitation', unite: '%',
      mesure: e.margeExp, precedente: e.margeExpPrecedente, tendance: margeTend,
      seuil: 'Marge stable ou en hausse (recul de plus d’un point = seuil non atteint).',
      statut: statut(e.margeExp != null && e.margeExpPrecedente != null, margeTend !== 'baisse'),
    },
    {
      cle: 'rentabilite', libelle: 'Rentabilité des capitaux propres', unite: '%',
      mesure: e.roe, precedente: null, tendance: null,
      seuil: 'Au moins 15 % des capitaux propres.',
      statut: statut(e.roe != null, (e.roe ?? 0) >= 0.15),
    },
    {
      cle: 'endettement', libelle: 'Endettement', unite: '%',
      mesure: e.famille === 'general' ? e.endettement : null, precedente: null, tendance: null,
      seuil: e.famille === 'general'
        ? 'Dette au plus égale à la moitié des capitaux propres.'
        : 'Sans objet pour une banque ou un assureur : la dette est leur matière première.',
      statut: e.famille !== 'general' ? 'non_applicable' : statut(e.endettement != null, (e.endettement ?? Infinity) <= 0.5),
    },
    {
      cle: 'dividende', libelle: 'Dividende', unite: 'FCFA',
      mesure: divs.length ? divs[divs.length - 1] : null,
      precedente: divs.length > 1 ? divs[divs.length - 2] : null,
      tendance: tendance(divs[divs.length - 1] ?? null, divs[divs.length - 2] ?? null, 0),
      seuil: 'Aucune baisse du dividende sur les exercices connus.',
      statut: statut(divs.length >= 2, !divBaisse),
    },
    {
      cle: 'valorisation', libelle: 'Valorisation (PER)', unite: 'x',
      mesure: e.per, precedente: e.perMediane, tendance: null,
      seuil: 'PER au plus égal à la médiane des sociétés comparables.',
      statut: statut(e.per != null && e.perMediane != null, (e.per ?? Infinity) <= (e.perMediane ?? -Infinity)),
    },
  ];
}

// ── Ex-date ─────────────────────────────────────────────────────────────────

/**
 * Le jour du détachement, le cours baisse en principe d'environ le dividende.
 * Une baisse inférieure à la MOITIÉ du dividende est inhabituelle : la date en
 * base est peut-être une autre date (paiement, assemblée). Constat seulement :
 * la date reste affichée, avec la réserve.
 */
export function controleExDate(e: { dividende: number; baisse: number }): 'coherente' | 'a_verifier' {
  return e.dividende > 0 && e.baisse / e.dividende < 0.5 ? 'a_verifier' : 'coherente';
}

// ── Rentabilité de l'actif ──────────────────────────────────────────────────

/**
 * Résultat net / actif total quand le bilan de l'exercice est en base. Sinon,
 * l'approximation par (capitaux propres + dette) est rendue SOUS SON NOM :
 * « capitaux investis ». Le dossier SNTS du 10/10/2026 affichait 25,1 % sous
 * le titre « rentabilité de l'actif », quand l'actif total, en base, la donnait
 * à 12,6 % : une approximation présentée comme la mesure double le chiffre.
 */
export function rentabiliteActif(e: {
  resultatNet: number | null;
  totalActif: number | null;
  capitauxPropres: number | null;
  dette: number | null;
}): { valeur: number; mesure: 'actif_total' | 'capitaux_investis' } | null {
  if (e.resultatNet == null) return null;
  if (e.totalActif != null && e.totalActif > 0) return { valeur: e.resultatNet / e.totalActif, mesure: 'actif_total' };
  const investis = e.capitauxPropres != null && e.dette != null ? e.capitauxPropres + e.dette : null;
  return investis != null && investis > 0 ? { valeur: e.resultatNet / investis, mesure: 'capitaux_investis' } : null;
}

// ── Fiscalité du dividende ──────────────────────────────────────────────────

/**
 * Taux de l'impôt sur le revenu des valeurs mobilières, lu dans le barème
 * SOURCÉ du pays de l'émetteur (`lib/tax/rates.ts`). Le dossier écrivait 12 %
 * pour toutes les valeurs : faux au Sénégal et en Côte d'Ivoire (10 %), au
 * Mali (7 %), au Bénin (5 %). Pays inconnu ou taux non vérifié : `null`, et le
 * dossier n'affiche alors aucun chiffre.
 */
export function fiscaliteDividende(paysBrut: string | null): { pays: string | null; taux: number | null } {
  const code = toPaysUemoa(paysBrut);
  if (!code) return { pays: paysBrut?.trim() || null, taux: null };
  return { pays: PAYS_LABELS[code], taux: BAREME[code].dividende_cote.taux };
}
